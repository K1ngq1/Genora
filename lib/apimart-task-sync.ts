import type { Task } from "@prisma/client";
import { downloadApimartFile, getApimartTask } from "@/lib/apimart";
import { db } from "@/lib/db";
import { saveBuffer } from "@/lib/storage";

function safeJsonParse(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch { return {}; }
}

export function isApimartTask(task: Task) {
  return safeJsonParse(task.params).provider === "apimart";
}

export async function syncApimartTask(task: Task) {
  if (!task.remoteTaskId || !isApimartTask(task)) return task;
  const params = safeJsonParse(task.params);
  const service = task.type === "image" ? "image" : "video";
  const remote = await getApimartTask(task.remoteTaskId, service, String(params.model ?? ""));
  const actualCredits = remote.creditsCost ?? params.actualCredits;
  const nextParams = JSON.stringify({ ...params, actualCredits, lastRemoteStatus: remote.status });

  if (remote.status === "failed" || remote.status === "cancelled") {
    return db.task.update({
      where: { id: task.id },
      data: { status: remote.status, error: remote.error ?? "APIMART_TASK_FAILED", params: nextParams },
    });
  }
  if (remote.status !== "completed") {
    return db.task.update({
      where: { id: task.id },
      data: { status: remote.status === "pending" ? "queued" : "processing", params: nextParams },
    });
  }
  if (!remote.outputUrl) {
    return db.task.update({ where: { id: task.id }, data: { status: "failed", error: "APIMART_RESULT_MISSING", params: nextParams } });
  }

  let output: Buffer;
  try {
    output = await downloadApimartFile(remote.outputUrl);
  } catch {
    return db.task.update({ where: { id: task.id }, data: { status: "failed", error: "DOWNLOAD_FAILED", params: nextParams } });
  }
  const outputPath = await saveBuffer(task.type === "image" ? "images" : "videos", `${task.id}.${task.type === "image" ? "png" : "mp4"}`, output);
  return db.task.update({
    where: { id: task.id },
    data: { status: "completed", outputPath, error: null, params: nextParams },
  });
}
