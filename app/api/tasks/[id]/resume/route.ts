import { db } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/error-codes";
import { providerLog } from "@/lib/provider-log";
import { ownsTask, publicTask } from "@/lib/tasks";
import { getVisitorId } from "@/lib/visitor";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const visitorId = getVisitorId(request);
  const task = await db.task.findUnique({ where: { id } });
  if (!ownsTask(task, visitorId)) {
    providerLog("task", "ownership-denied", { id, found: Boolean(task) });
    return errorResponse(new AppError("TASK_NOT_FOUND", 404), 404);
  }

  if (task.type === "image") {
    return errorResponse(new AppError("UNKNOWN_ERROR", 400, "生图任务不支持恢复查询"), 400);
  }

  if (task.status !== "timeout" || !task.canResume) {
    return errorResponse(new AppError("UNKNOWN_ERROR", 400, "任务不在可恢复状态"), 400);
  }

  if (!task.remoteTaskId) {
    return errorResponse(new AppError("UNKNOWN_ERROR", 400, "任务没有上游 taskId，无法继续查询"), 400);
  }

  // Parse existing params and add resumedAt timestamp
  const safeJsonParse = (text: string): Record<string, unknown> => {
    if (!text) return {};
    try { return JSON.parse(text); } catch { return {}; }
  };
  const params = safeJsonParse(task.params);
  params.resumedAt = Date.now();
  // Clear lastRemoteStatus so it shows the new status from next poll
  delete params.lastRemoteStatus;

  const updated = await db.task.update({
    where: { id },
    data: {
      status: "queued",
      canResume: false,
      error: null,
      params: JSON.stringify(params),
    },
  });

  return Response.json(publicTask(updated));
}
