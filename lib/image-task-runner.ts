import type { Task } from "@prisma/client";

function safeJsonParse(text: string): Record<string, unknown> {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}
import { generateAgnesImage } from "@/lib/agnes";
import { createApimartImage, uploadApimartImage } from "@/lib/apimart";
import { db } from "@/lib/db";
import { generateIdeogramImage, isIdeogramModel } from "@/lib/ideogram";
import { saveBuffer } from "@/lib/storage";
import { errorMessage } from "@/lib/tasks";
import { isActiveTaskStatus } from "@/lib/task-status";
import { mimeFromName } from "@/lib/storage";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { errorDetail } from "@/lib/error-codes";
import { sanitizeApimartDetail } from "@/lib/apimart";

type ImageTaskParams = {
  size?: string;
  model?: string;
  seed?: number;
  provider?: string;
  ratio?: string;
  resolution?: string;
  referencePaths?: string[];
};

const activeImageTasks = new Map<string, Promise<Task | null>>();

function parseSize(size = "1024x1024") {
  const [width, height] = size.split("x").map((value) => Number(value));
  return {
    width: Number.isFinite(width) && width > 0 ? width : 1024,
    height: Number.isFinite(height) && height > 0 ? height : 1024,
  };
}

async function executeImageTask(taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task || task.type !== "image" || !isActiveTaskStatus(task.status)) return task;
  const params = safeJsonParse(task.params) as ImageTaskParams;
  const model = params.model ?? "agnes-image-2.1-flash";

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
      const remoteTaskId = await createApimartImage({
        model,
        prompt: task.prompt,
        ratio: params.ratio ?? "1:1",
        resolution: params.resolution ?? "1k",
        imageUrls,
      });
      return db.task.update({ where: { id: task.id }, data: { status: "queued", remoteTaskId } });
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
    const image = isIdeogramModel(model)
      ? await generateIdeogramImage({
          prompt: task.prompt,
          model,
          seed: Number(params.seed ?? 0),
          ...parseSize(params.size),
        })
      : await generateAgnesImage(task.prompt);

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
