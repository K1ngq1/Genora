import type { Task } from "@prisma/client";
import { downloadApimartFile, getApimartTask } from "@/lib/apimart";
import { db } from "@/lib/db";
import { saveBuffer } from "@/lib/storage";
import { getImageSize, getVideoDimensions, isQualityRelatedError } from "@/lib/generation-quality";
import { providerLog } from "@/lib/provider-log";

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
    const fallbacks = Array.isArray(params.qualityFallbacks) ? params.qualityFallbacks.map(String) : [];
    const currentQuality = String(params.actualQuality ?? params.resolution ?? "").toLowerCase();
    const currentIndex = fallbacks.indexOf(currentQuality);
    const nextQuality = currentIndex >= 0 ? fallbacks[currentIndex + 1] : undefined;
    if (remote.status === "failed" && nextQuality && isQualityRelatedError(remote.error)) {
      const ratio = String(params.aspectRatio ?? params.ratio ?? "16:9");
      const finalSize = task.type === "image"
        ? getImageSize(ratio, nextQuality)
        : getVideoDimensions(ratio, nextQuality).finalSize;
      providerLog("apimart-sync", "quality-downgrade", { localTaskId: task.id, model: String(params.model ?? ""), aspectRatio: ratio, from: currentQuality, to: nextQuality, error: remote.error ?? "" });
      const retried = await db.task.update({
        where: { id: task.id },
        data: {
          status: "pending",
          remoteTaskId: null,
          error: null,
          params: JSON.stringify({ ...params, actualCredits, lastRemoteStatus: remote.status, actualQuality: nextQuality, finalSize, qualityAttempts: [...(Array.isArray(params.qualityAttempts) ? params.qualityAttempts : []), nextQuality] }),
        },
      });
      if (task.type === "image") {
        const { scheduleImageTask } = await import("@/lib/image-task-runner");
        scheduleImageTask(task.id);
      } else {
        const { scheduleVideoTask } = await import("@/lib/video-task-runner");
        scheduleVideoTask(task.id);
      }
      return retried;
    }
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
