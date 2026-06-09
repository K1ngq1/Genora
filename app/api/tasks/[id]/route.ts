import { db } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/error-codes";
import { startImageTask } from "@/lib/image-task-runner";
import { publicTask } from "@/lib/tasks";
import { syncVideoTask } from "@/lib/video-task-sync";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let task = await db.task.findUnique({ where: { id } });
  if (!task) return errorResponse(new AppError("TASK_NOT_FOUND", 404), 404);

  if (task.type === "image" && ["pending", "processing"].includes(task.status)) {
    void startImageTask(task.id);
    task = await db.task.findUnique({ where: { id } }) ?? task;
  }

  const synced = task.type === "image" ? { task } : await syncVideoTask(task);
  task = synced.task;

  return Response.json({
    ...publicTask(task),
    syncError: synced.syncError ?? null,
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = await db.task.findUnique({ where: { id } });
  if (!task) return errorResponse(new AppError("TASK_NOT_FOUND", 404), 404);

  const timedOut = new URL(request.url).searchParams.get("reason") === "timeout";
  const updated = await db.task.update({
    where: { id },
    data: {
      status: timedOut ? "timeout" : "cancelled",
      error: timedOut ? (task.type === "image" ? "TASK_POLL_TIMEOUT" : "AGNES_VIDEO_POLL_TIMEOUT") : "TASK_CANCELLED",
      canResume: timedOut && task.type !== "image" ? true : false,
    },
  });

  return Response.json(publicTask(updated));
}