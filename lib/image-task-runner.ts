import type { Task } from "@prisma/client";

function safeJsonParse(text: string): Record<string, unknown> {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}
import { generateAgnesImage } from "@/lib/agnes";
import { createApimartImage, uploadApimartImage } from "@/lib/apimart";
import { db } from "@/lib/db";
import { saveBuffer } from "@/lib/storage";
import { errorMessage } from "@/lib/tasks";
import { isActiveTaskStatus } from "@/lib/task-status";
import { mimeFromName } from "@/lib/storage";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { errorDetail } from "@/lib/error-codes";
import { sanitizeApimartDetail } from "@/lib/apimart";
import { getImageSize, imageQualityFallbacks, isQualityRelatedError, type ImageQuality } from "@/lib/generation-quality";
import { providerLog } from "@/lib/provider-log";

type ImageTaskParams = {
  size?: string;
  model?: string;
  provider?: string;
  ratio?: string;
  resolution?: string;
  quality?: string;
  actualQuality?: ImageQuality;
  qualityFallbacks?: ImageQuality[];
  finalSize?: string;
  aspectRatio?: string;
  qualityAttempts?: ImageQuality[];
  referencePaths?: string[];
};

const activeImageTasks = new Map<string, Promise<Task | null>>();

async function executeImageTask(taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.type !== "image" || !isActiveTaskStatus(task.status)) return task;
  const params = safeJsonParse(task.params) as ImageTaskParams;
  const model = params.model ?? "agnes-image-2.1-flash";
  const aspectRatio = params.aspectRatio ?? params.ratio ?? "16:9";
  const allQualityFallbacks = params.qualityFallbacks?.length
    ? params.qualityFallbacks
    : imageQualityFallbacks(params.actualQuality ?? params.resolution);
  const qualityStart = params.actualQuality ? allQualityFallbacks.indexOf(params.actualQuality) : 0;
  const qualityFallbacks = allQualityFallbacks.slice(Math.max(0, qualityStart));

  if (params.provider === "apimart") {
    if (task.remoteTaskId) return task;
    const claim = await db.task.updateMany({
      where: { id: task.id, status: "pending", remoteTaskId: null },
      data: { status: "submitting", error: null },
    });
    if (!claim.count) return db.task.findUnique({ where: { id: task.id } });
    try {
      const imageUrls: string[] = [];
      for (const filePath of params.referencePaths ?? []) {
        const bytes = await readFile(filePath);
        imageUrls.push(await uploadApimartImage(new Blob([new Uint8Array(bytes)], { type: mimeFromName(filePath) }), basename(filePath), "image", model));
      }
      const attempts: ImageQuality[] = [];
      let lastError: unknown;
      for (const quality of qualityFallbacks) {
        attempts.push(quality);
        const finalSize = getImageSize(aspectRatio, quality);
        try {
          providerLog("apimart-image", "submit-quality", { model, aspectRatio, quality, finalSize });
          const remoteTaskId = await createApimartImage({ model, prompt: task.prompt, ratio: aspectRatio, resolution: quality, imageUrls });
          return db.task.update({
            where: { id: task.id },
            data: { status: "queued", remoteTaskId, params: JSON.stringify({ ...params, actualQuality: quality, finalSize, qualityAttempts: attempts }) },
          });
        } catch (error) {
          lastError = error;
          if (!isQualityRelatedError(error) || quality === qualityFallbacks.at(-1)) throw error;
          providerLog("apimart-image", "quality-downgrade", { model, aspectRatio, from: quality, to: qualityFallbacks[attempts.length] ?? "none" });
        }
      }
      throw lastError;
    } catch (error) {
      const errorCode = errorMessage(error);
      const providerErrorDetail = sanitizeApimartDetail(errorDetail(error));
      return db.task.update({
        where: { id: task.id },
        data: { status: "failed", error: errorCode, params: JSON.stringify({ ...params, errorCode, providerErrorDetail }) },
      });
    }
  }

  await db.task.update({ where: { id: task.id }, data: { status: "processing", error: null } });

  try {
    let image: Buffer | undefined;
    const attempts: ImageQuality[] = [];
    let usedQuality = qualityFallbacks[0] ?? "1k";
    let lastError: unknown;
    for (const quality of qualityFallbacks) {
      attempts.push(quality);
      usedQuality = quality;
      const finalSize = getImageSize(aspectRatio, quality);
      try {
        image = await generateAgnesImage(task.prompt, { aspectRatio, quality, size: finalSize });
        await db.task.update({ where: { id: task.id }, data: { params: JSON.stringify({ ...params, actualQuality: quality, finalSize, qualityAttempts: attempts }) } });
        break;
      } catch (error) {
        lastError = error;
        if (!isQualityRelatedError(error) || quality === qualityFallbacks.at(-1)) throw error;
        providerLog("agnes-image", "quality-downgrade", { model, aspectRatio, from: quality, to: qualityFallbacks[attempts.length] ?? "none" });
      }
    }
    if (!image) throw lastError ?? new Error(`Image generation failed at ${usedQuality}`);

    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return current;

    const outputPath = await saveBuffer("images", `${task.id}.png`, image);
    const afterSave = await db.task.findUnique({ where: { id: task.id } });
    if (!afterSave || afterSave.status === "cancelled") return afterSave;

    return db.task.update({
      where: { id: task.id },
      data: { status: "completed", outputPath, error: null },
    });
  } catch (error) {
    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return current;
    return db.task.update({
      where: { id: task.id },
      data: { status: "failed", error: errorMessage(error) },
    });
  }
}

export function startImageTask(taskId: string) {
  const active = activeImageTasks.get(taskId);
  if (active) return active;
  const execution = executeImageTask(taskId).finally(() => activeImageTasks.delete(taskId));
  activeImageTasks.set(taskId, execution);
  return execution;
}

export function scheduleImageTask(taskId: string) {
  queueMicrotask(() => void startImageTask(taskId));
}
