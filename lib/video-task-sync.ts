import type { Task } from "@prisma/client";
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
  if (!active || !task.remoteTaskId || task.type === "image") {
    videoLog("sync-skip", { localTaskId: task.id, status: task.status, reason: !active ? "inactive" : !task.remoteTaskId ? "no-remote-id" : "image-type" });
    return { task };
  }

  // Use resumedAt from params as reference time if available, otherwise use createdAt
  const params = safeJsonParse(task.params);
  const resumedAt = params.resumedAt ? Number(params.resumedAt) : null;
  const referenceTime = resumedAt ?? new Date(task.createdAt).getTime();
  const elapsedSeconds = (Date.now() - referenceTime) / 1000;
  videoLog("sync-elapsed", { localTaskId: task.id, elapsedSec: String(elapsedSeconds.toFixed(0)), maxSec: String(MAX_PROCESSING_SECONDS), referenceTime: String(new Date(referenceTime).toISOString()), hasResumeAt: String(Boolean(resumedAt)) });

  if (elapsedSeconds > MAX_PROCESSING_SECONDS) {
    videoLog("sync-timeout", { localTaskId: task.id, elapsedSec: String(elapsedSeconds.toFixed(0)) });
    try {
      return {
        task: await db.task.update({
          where: { id: task.id },
          data: {
            status: "failed",
            error: "Video task timeout",
            canResume: false,
            params: JSON.stringify({ ...params, errorCode: "TIMEOUT" }),
          },
        }),
        syncError: "TIMEOUT",
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
  const results: VideoTaskSync[] = [];
  const legacyTimeouts = await db.task.findMany({
    where: {
      status: "timeout",
      type: { not: "image" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  for (const task of legacyTimeouts) {
    const params = safeJsonParse(task.params);
    const finalized = await db.task.update({
      where: { id: task.id },
      data: {
        status: "failed",
        error: "Video task timeout",
        canResume: false,
        params: JSON.stringify({ ...params, errorCode: "TIMEOUT" }),
      },
    });
    videoLog("legacy-timeout-finalized", { localTaskId: task.id, lastRemoteStatus: String(params.lastRemoteStatus ?? "unknown") });
    results.push({ task: finalized, syncError: "TIMEOUT" });
  }

  const tasks = await db.task.findMany({
    where: {
      status: { in: ["pending", "submitting", "queued", "processing", "downloading"] },
      remoteTaskId: { not: null },
      type: { not: "image" },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  for (const task of tasks) {
    results.push(await syncVideoTask(task));
  }
  return results;
}

// ====== SERVER-SIDE BACKGROUND POLLING ======
// Runs every 10s to keep video tasks synced even when no frontend is active
export function ensureBackgroundVideoPolling() {
  if (typeof window !== "undefined") return;
  const pollingGlobal = globalThis as typeof globalThis & {
    __genora_video_sync_interval?: ReturnType<typeof setInterval>;
    __video_sync_tick?: number;
  };
  if (pollingGlobal.__genora_video_sync_interval) return;
  
  console.log("[video-sync] starting background polling (interval: 10s, max tasks: 8)");
  
  const interval = setInterval(() => {
    syncProcessingVideoTasks(8).then((results) => {
      if (results.length > 0) {
        const statuses = results.map((result) => `${result.task.status}/${result.task.error || "ok"}`).join(",");
        if (!statuses.includes("completed") && !statuses.includes("failed")) {
          const tick = (pollingGlobal.__video_sync_tick || 0) + 1;
          pollingGlobal.__video_sync_tick = tick;
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
  
  pollingGlobal.__genora_video_sync_interval = interval;
  
  if (typeof process !== "undefined") {
    process.on("beforeExit", () => clearInterval(interval));
  }
}
