import type { Task } from "@prisma/client";
import { createAgnesVideo } from "@/lib/agnes";
import { createApimartVideo, uploadApimartImage } from "@/lib/apimart";
import { combineGenerationPrompts } from "@/lib/prompt-options";
import { db } from "@/lib/db";
import { mimeFromName } from "@/lib/storage";
import { errorMessage } from "@/lib/tasks";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

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
  duration?: number;
  startFramePath?: string;
  endFramePath?: string;
  referencePaths?: string[];
};

const activeVideoTasks = new Map<string, Promise<Task | null>>();

async function imageDataUrl(path: string, mime?: string) {
  return `data:${mime ?? mimeFromName(path)};base64,${(await readFile(path)).toString("base64")}`;
}

function videoLog(section: string, detail: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const parts = Object.entries(detail).map(([k, v]) => {
    const val = String(v ?? "");
    if (val.length > 300) return k + "=" + val.slice(0, 300) + "...(trimmed)";
    return k + "=" + val;
  }).join(" ");
  console.log("[" + ts + "] [video-runner] " + section + " " + parts);
}

async function executeVideoTask(taskId: string) {
  const claim = await db.task.updateMany({
    where: { id: taskId, status: "pending", remoteTaskId: null },
    data: { status: "submitting", error: null, canResume: false },
  });
  if (claim.count === 0) return db.task.findUnique({ where: { id: taskId } });

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.type === "image") return task;
  videoLog("task-start", { taskId: task.id, localTaskId: task.id, type: task.type });

  const params = safeJsonParse(task.params) as VideoTaskParams;
  const negativePrompt = params.negativePrompt ?? "";

  try {
    if (params.provider === "apimart") {
      const uploadPath = async (filePath?: string) => {
        if (!filePath) return undefined;
        const bytes = await readFile(filePath);
        return uploadApimartImage(new Blob([new Uint8Array(bytes)], { type: mimeFromName(filePath) }), basename(filePath), "video");
      };
      const startFrameUrl = await uploadPath(params.startFramePath ?? task.inputPath ?? undefined);
      const endFrameUrl = await uploadPath(params.endFramePath);
      const referenceUrls: string[] = [];
      for (const filePath of params.referencePaths ?? []) {
        referenceUrls.push(String(await uploadPath(filePath)));
      }
      const remoteTaskId = await createApimartVideo({
        model: params.model,
        prompt: task.prompt,
        negativePrompt,
        ratio: params.ratio ?? "16:9",
        resolution: params.resolution ?? "720p",
        duration: params.duration ?? 5,
        startFrameUrl,
        endFrameUrl,
        referenceUrls,
      });
      const current = await db.task.findUnique({ where: { id: task.id } });
      if (!current || current.status === "cancelled") return current;
      return db.task.update({ where: { id: task.id }, data: { status: "queued", remoteTaskId } });
    }

    const combinedPrompt = combineGenerationPrompts(task.prompt, negativePrompt);
    const payload: Record<string, unknown> = {
      model: params.model,
      prompt: combinedPrompt,
      width: params.width,
      height: params.height,
      num_frames: params.numFrames,
      frame_rate: params.frameRate,
    };
    if (negativePrompt) payload.negative_prompt = negativePrompt;
    if (task.inputPath) payload.image = await imageDataUrl(task.inputPath);

    const remoteTaskId = await createAgnesVideo(payload);

    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return current;

    videoLog("task-queued", { localTaskId: task.id, remoteTaskId, status: "queued" });
    return db.task.update({
      where: { id: task.id },
      data: { status: "queued", remoteTaskId },
    });
  } catch (error) {
    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return current;
    const errorCode = errorMessage(error);
    const timedOut = errorCode === "AGNES_REQUEST_TIMEOUT";
    videoLog(timedOut ? "task-timeout" : "task-failed", { localTaskId: task.id, errorCode, detail: String(error) });
    return db.task.update({
      where: { id: task.id },
      data: { status: timedOut ? "timeout" : "failed", error: errorCode, canResume: false },
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
