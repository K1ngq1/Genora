import type { Task } from "@/generated/prisma";
import { syncAgnesVideo } from "@/lib/agnes";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/tasks";
import { isActiveTaskStatus } from "@/lib/task-status";

export type VideoTaskSync = {
  task: Task;
  syncError?: string;
};

const MAX_PROCESSING_SECONDS = Number(process.env.AGNES_VIDEO_MAX_PROCESSING_SECONDS ?? 900);

const activeSyncs = new Map<string, Promise<VideoTaskSync>>();

async function runVideoTaskSync(task: Task): Promise<VideoTaskSync> {
  const active = isActiveTaskStatus(task.status);
  if (!active && task.status !== "timeout" || !task.remoteTaskId || task.type === "image") {
    return { task };
  }

  const elapsedSeconds = (Date.now() - new Date(task.createdAt).getTime()) / 1000;
  if (elapsedSeconds > MAX_PROCESSING_SECONDS && !task.canResume) {
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
    const current = await db.task.findUnique({ where: { id: task.id } });
    if (!current || current.status === "cancelled") return { task: current ?? task };

    return {
      task: await db.task.update({
        where: { id: task.id },
        data: {
          status: result.status ?? "processing",
          outputPath: result.outputPath ?? null,
          error: result.error ?? null,
          canResume: false,
        },
      }),
    };
  } catch (error) {
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