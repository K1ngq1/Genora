import type { Task } from "@/generated/prisma";
import { syncAgnesVideo } from "@/lib/agnes";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/tasks";
import { isActiveTaskStatus } from "@/lib/task-status";

function safeJsonParse(text: string): Record<string, unknown> {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

export type VideoTaskSync = {
  task: Task;
  syncError?: string;
};

const MAX_PROCESSING_SECONDS = Number(process.env.AGNES_VIDEO_MAX_PROCESSING_SECONDS ?? 900);

const activeSyncs = new Map<string, Promise<VideoTaskSync>>();

function videoLog(section: string, detail: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const parts = Object.entries(detail).map(([k, v]) => {
    const val = String(v ?? "");
    if (val.length > 300) return k + "=" + val.slice(0, 300) + "...(trimmed)";
    return k + "=" + val;
  }).join(" ");
  console.log("[" + ts + "] [video-sync] " + section + " " + parts);
}

async function runVideoTaskSync(task: Task): Promise<VideoTaskSync> {
  videoLog("sync-check", { localTaskId: task.id, remoteTaskId: String(task.remoteTaskId ?? "null"), status: task.status, canResume: String(task.canResume), type: task.type });
  const active = isActiveTaskStatus(task.status);
  if (!active && task.status !== "timeout" || !task.remoteTaskId || task.type === "image") {
    videoLog("sync-skip", { localTaskId: task.id, status: task.status, reason: !active && task.status !== "timeout" ? "inactive" : !task.remoteTaskId ? "no-remote-id" : "image-type" });
    return { task };
  }

  // Use resumedAt from params as reference time if available, otherwise use createdAt
  const params = safeJsonParse(task.params);
  const resumedAt = params.resumedAt ? Number(params.resumedAt) : null;
  const referenceTime = resumedAt ?? new Date(task.createdAt).getTime();
  const elapsedSeconds = (Date.now() - referenceTime) / 1000;
  videoLog("sync-elapsed", { localTaskId: task.id, elapsedSec: String(elapsedSeconds.toFixed(0)), maxSec: String(MAX_PROCESSING_SECONDS), referenceTime: String(new Date(referenceTime).toISOString()), hasResumeAt: String(Boolean(resumedAt)) });

  if (elapsedSeconds > MAX_PROCESSING_SECONDS && !task.canResume) {
      videoLog("sync-timeout", { localTaskId: task.id, elapsedSec: String(elapsedSeconds.toFixed(0)) });
    try {
      return {
        task: await db.task.update({
          where: { id: task.id },
          data: { status: "timeout", error: "AGNES_VIDEO_TIMEOUT", canResume: true },
        }),
        syncError: "AGNES_VIDEO_TIMEOUT",
      };
    } catch (updateError) {
      return { task, syncError: errorMessage(updateError) };
    }
  }

  try {
    const result = await syncAgnesVideo(task.remoteTaskId, task.id);
    videoLog("sync-result", { localTaskId: task.id, remoteStatus: String(result.lastRemoteStatus ?? "unknown"), resultStatus: String(result.status ?? "unknown"), hasOutputPath: String(Boolean(result.outputPath)), hasError: String(Boolean(result.error)) });
    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return { task: current ?? task };

    // Merge lastRemoteStatus into params for debugging
    const updatedParams = { ...params };
    if (result.lastRemoteStatus) {
      updatedParams.lastRemoteStatus = result.lastRemoteStatus;
    }
    const updatedParamsStr = JSON.stringify(updatedParams);

    return {
      task: await db.task.update({
        where: { id: task.id },
        data: {
          status: result.status ?? "processing",
          outputPath: result.outputPath ?? null,
          error: result.status === "completed" ? null : (result.error ?? null),
          canResume: false,
          params: updatedParamsStr,
        },
      }),
    };
  } catch (error) {
    videoLog("sync-exception", { localTaskId: task.id, error: String(error), errorCode: errorMessage(error) });
    const code = errorMessage(error);
    return {
      task: await db.task.update({
        where: { id: task.id },
        data: { status: "failed", error: code },
      }),
      syncError: code,
    };
  }
}

export async function syncVideoTask(task: Task): Promise<VideoTaskSync> {
  const current = activeSyncs.get(task.id);
  if (current) return current;
  const sync = runVideoTaskSync(task).finally(() => activeSyncs.delete(task.id));
  activeSyncs.set(task.id, sync);
  return sync;
}

export async function syncProcessingVideoTasks(limit = 4) {
  const tasks = await db.task.findMany({
    where: {
      status: { in: ["pending", "queued", "processing", "downloading", "timeout"] },
      remoteTaskId: { not: null },
      type: { not: "image" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const results: VideoTaskSync[] = [];
  for (const task of tasks) {
    results.push(await syncVideoTask(task));
  }
  return results;
}

// ====== SERVER-SIDE BACKGROUND POLLING ======
// Runs every 10s to keep video tasks synced even when no frontend is active
function startBackgroundPolling() {
  if (typeof window !== "undefined") return;
  var key = "__genora_video_sync_interval";
  if ((globalThis as any)[key]) return;
  
  console.log("[video-sync] starting background polling (interval: 10s, max tasks: 8)");
  
  var interval = setInterval(() => {
    syncProcessingVideoTasks(8).then((results) => {
      if (results.length > 0) {
        var statuses = results.map((r) => r.task.status + "/" + ((r.task as any).error || "ok")).join(",");
        if (!statuses.includes("completed") && !statuses.includes("failed")) {
          // Only log periodically to reduce noise
          var tick = ((globalThis as any).__video_sync_tick || 0) + 1;
          (globalThis as any).__video_sync_tick = tick;
          if (tick % 60 === 0) {
            console.log("[video-sync] background poll: " + results.length + " tasks (" + statuses + ")");
          }
        } else {
          console.log("[video-sync] background poll: " + results.length + " tasks (" + statuses + ")");
        }
      }
    }).catch((err) => {
      console.error("[video-sync] background poll error:", String(err));
    });
  }, 10000);
  
  (globalThis as any)[key] = interval;
  
  if (typeof process !== "undefined") {
    process.on("beforeExit", () => clearInterval(interval));
  }
}

startBackgroundPolling();