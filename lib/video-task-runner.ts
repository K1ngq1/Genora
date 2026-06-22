import type { Task } from "@prisma/client";
import { createAgnesVideo } from "@/lib/agnes";
import { createApimartVideo, uploadApimartImage } from "@/lib/apimart";
import { combineGenerationPrompts } from "@/lib/prompt-options";
import { db } from "@/lib/db";
import { mimeFromName } from "@/lib/storage";
import { errorMessage } from "@/lib/tasks";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { errorDetail } from "@/lib/error-codes";
import { sanitizeApimartDetail } from "@/lib/apimart";
import { buildAgnesImagePayloadFields, prepareAgnesPublicImages } from "@/lib/agnes-video-input";
import { providerLog } from "@/lib/provider-log";
import { getVideoDimensions, isQualityRelatedError, videoQualityFallbacks, type VideoQuality } from "@/lib/generation-quality";

function safeJsonParse(text: string): Record<string, unknown> {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

type VideoTaskParams = {
  width: number;
  height: number;
  numFrames: number;
  frameRate: number;
  model: string;
  negativePrompt?: string;
  provider?: string;
  ratio?: string;
  resolution?: string;
  quality?: string;
  actualQuality?: string;
  qualityFallbacks?: VideoQuality[];
  finalSize?: string;
  aspectRatio?: string;
  qualityAttempts?: VideoQuality[];
  duration?: number;
  startFramePath?: string;
  startFrameName?: string;
  endFramePath?: string;
  endFrameName?: string;
  referencePaths?: string[];
  referenceNames?: string[];
  publicImageUrls?: { startFrameUrl?: string; referenceUrls: string[]; endFrameUrl?: string };
  publicImagePreflight?: Array<{ url: string; status: number; contentType: string }>;
};

const activeVideoTasks = new Map<string, Promise<Task | null>>();

async function executeVideoTask(taskId: string) {
  const claim = await db.task.updateMany({
    where: { id: taskId, status: "pending", remoteTaskId: null },
    data: { status: "submitting", error: null, canResume: false },
  });
  if (claim.count === 0) return db.task.findUnique({ where: { id: taskId } });

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.type === "image") return task;
  providerLog("video-runner", "task-start", { taskId: task.id, localTaskId: task.id, type: task.type });

  const params = safeJsonParse(task.params) as VideoTaskParams;
  let persistedParams = params;
  const negativePrompt = params.negativePrompt ?? "";

  try {
    if (params.provider === "apimart") {
      const uploadPath = async (filePath?: string) => {
        if (!filePath) return undefined;
        const bytes = await readFile(filePath);
        return uploadApimartImage(new Blob([new Uint8Array(bytes)], { type: mimeFromName(filePath) }), basename(filePath), "video", params.model);
      };
      const startFrameUrl = await uploadPath(params.startFramePath ?? task.inputPath ?? undefined);
      const endFrameUrl = await uploadPath(params.endFramePath);
      const referenceUrls: string[] = [];
      for (const filePath of params.referencePaths ?? []) {
        referenceUrls.push(String(await uploadPath(filePath)));
      }
      const ratio = params.aspectRatio ?? params.ratio ?? "16:9";
      const allQualities = params.qualityFallbacks?.length ? params.qualityFallbacks : videoQualityFallbacks(params.actualQuality ?? params.resolution);
      const startIndex = params.actualQuality ? allQualities.indexOf(params.actualQuality as VideoQuality) : 0;
      const qualities = allQualities.slice(Math.max(0, startIndex));
      const attempts: VideoQuality[] = [];
      let lastError: unknown;
      for (const quality of qualities) {
        attempts.push(quality);
        try {
          const remoteTaskId = await createApimartVideo({
            model: params.model, prompt: task.prompt, negativePrompt, ratio, resolution: quality,
            duration: params.duration ?? 5, startFrameUrl, endFrameUrl, referenceUrls,
          });
          const current = await db.task.findUnique({ where: { id: task.id } });
          if (!current || current.status === "cancelled") return current;
          const finalSize = getVideoDimensions(ratio, quality).finalSize;
          return db.task.update({ where: { id: task.id }, data: { status: "queued", remoteTaskId, params: JSON.stringify({ ...params, actualQuality: quality, finalSize, qualityAttempts: attempts }) } });
        } catch (error) {
          lastError = error;
          if (!isQualityRelatedError(error) || quality === qualities.at(-1)) throw error;
          providerLog("video-runner", "quality-downgrade", { model: params.model, aspectRatio: ratio, from: quality, to: qualities[attempts.length] ?? "none" });
        }
      }
      throw lastError;
    }

    const combinedPrompt = combineGenerationPrompts(task.prompt, negativePrompt);
    const ratio = params.aspectRatio ?? params.ratio ?? "16:9";
    const payload: Record<string, unknown> = {
      model: params.model,
      prompt: combinedPrompt,
      num_frames: params.numFrames,
      frame_rate: params.frameRate,
    };
    if (negativePrompt) payload.negative_prompt = negativePrompt;
    const startFramePath = params.startFramePath ?? task.inputPath ?? undefined;
    if (startFramePath || params.endFramePath || params.referencePaths?.length) {
      const prepared = await prepareAgnesPublicImages({
        startFrame: startFramePath ? { path: startFramePath, originalName: params.startFrameName } : undefined,
        references: (params.referencePaths ?? []).map((path, index) => ({ path, originalName: params.referenceNames?.[index] })),
        endFrame: params.endFramePath ? { path: params.endFramePath, originalName: params.endFrameName } : undefined,
      });
      const publicImageUrls = {
        startFrameUrl: prepared.startFrameUrl,
        referenceUrls: prepared.referenceUrls,
        endFrameUrl: prepared.endFrameUrl,
      };
      persistedParams = { ...params, publicImageUrls, publicImagePreflight: prepared.preflight };
      await db.task.update({ where: { id: task.id }, data: { params: JSON.stringify(persistedParams) } });
      Object.assign(payload, buildAgnesImagePayloadFields(publicImageUrls));
    }
    const allQualities = params.qualityFallbacks?.length ? params.qualityFallbacks : videoQualityFallbacks(params.actualQuality ?? params.resolution);
    const startIndex = params.actualQuality ? allQualities.indexOf(params.actualQuality as VideoQuality) : 0;
    const qualities = allQualities.slice(Math.max(0, startIndex));
    const attempts: VideoQuality[] = [];
    let remoteTaskId: string | undefined;
    let lastError: unknown;
    for (const quality of qualities) {
      attempts.push(quality);
      const size = getVideoDimensions(ratio, quality);
      const attemptPayload = { ...payload, width: size.width, height: size.height };
      providerLog("agnes-video", "final-payload", { localTaskId: task.id, aspectRatio: ratio, quality, finalSize: size.finalSize, payload: JSON.stringify(attemptPayload) });
      try {
        remoteTaskId = await createAgnesVideo(attemptPayload);
        persistedParams = { ...persistedParams, actualQuality: quality, finalSize: size.finalSize, qualityAttempts: attempts };
        await db.task.update({ where: { id: task.id }, data: { params: JSON.stringify(persistedParams) } });
        break;
      } catch (error) {
        lastError = error;
        if (!isQualityRelatedError(error) || quality === qualities.at(-1)) throw error;
        providerLog("agnes-video", "quality-downgrade", { model: params.model, aspectRatio: ratio, from: quality, to: qualities[attempts.length] ?? "none" });
      }
    }
    if (!remoteTaskId) throw lastError ?? new Error("Video submission failed");

    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return current;

    providerLog("video-runner", "task-queued", { localTaskId: task.id, remoteTaskId, status: "queued" });
    return db.task.update({
      where: { id: task.id },
      data: { status: "queued", remoteTaskId },
    });
  } catch (error) {
    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return current;
    const errorCode = errorMessage(error);
    const providerErrorDetail = params.provider === "apimart" ? sanitizeApimartDetail(errorDetail(error)) : undefined;
    const timedOut = errorCode === "AGNES_REQUEST_TIMEOUT";
    providerLog("video-runner", timedOut ? "task-timeout" : "task-failed", { localTaskId: task.id, errorCode, detail: String(error) });
    return db.task.update({
      where: { id: task.id },
      data: {
        status: timedOut ? "timeout" : "failed",
        error: errorCode,
        canResume: false,
        params: JSON.stringify({ ...persistedParams, errorCode, ...(providerErrorDetail ? { providerErrorDetail } : {}) }),
      },
    });
  }
}

export function startVideoTask(taskId: string) {
  const active = activeVideoTasks.get(taskId);
  if (active) return active;
  const execution = executeVideoTask(taskId).finally(() => activeVideoTasks.delete(taskId));
  activeVideoTasks.set(taskId, execution);
  return execution;
}

export function scheduleVideoTask(taskId: string) {
  queueMicrotask(() => void startVideoTask(taskId));
}
