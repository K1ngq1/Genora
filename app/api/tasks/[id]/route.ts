import { db } from "@/lib/db";
import { getUserId } from "@/lib/get-user-id";
import { AppError, errorResponse } from "@/lib/error-codes";
import { startImageTask } from "@/lib/image-task-runner";
import { isApimartTask, syncApimartTask } from "@/lib/apimart-task-sync";
import { publicTask } from "@/lib/tasks";
import { ensureBackgroundVideoPolling, syncVideoTask } from "@/lib/video-task-sync";
import { startVideoTask } from "@/lib/video-task-runner";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  const { id } = await context.params;
  let task = await db.task.findUnique({ where: { id, userId } });
  if (!task) return errorResponse(new AppError("TASK_NOT_FOUND", 404), 404);

  if (task.type === "image" && ["pending", "processing"].includes(task.status)) {
    void startImageTask(task.id);
    task = await db.task.findUnique({ where: { id } }) ?? task;
  }

  if (task.type !== "image" && task.status === "pending" && !task.remoteTaskId) {
    void startVideoTask(task.id);
    task = await db.task.findUnique({ where: { id } }) ?? task;
  }

  if (task.type !== "image") ensureBackgroundVideoPolling();
  const synced = isApimartTask(task)
    ? { task: await syncApimartTask(task) }
    : task.type === "image" ? { task } : await syncVideoTask(task);
  task = synced.task;

  return Response.json(
    {
      ...publicTask(task),
      syncError: synced.syncError ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  const { id } = await context.params;
  const task = await db.task.findUnique({ where: { id, userId } });
  if (!task) return errorResponse(new AppError("TASK_NOT_FOUND", 404), 404);

  const timedOut = new URL(request.url).searchParams.get("reason") === "timeout";
  const updated = await db.task.update({
    where: { id, userId },
    data: {
      status: timedOut ? "timeout" : "cancelled",
      error: timedOut ? (task.type === "image" ? "TASK_POLL_TIMEOUT" : "AGNES_VIDEO_TIMEOUT") : "INTERRUPTED_BY_USER",
      canResume: timedOut && task.type !== "image" ? true : false,
    },
  });

  return Response.json(publicTask(updated));
}
