import type { Task } from "@prisma/client";
import { errorCodeFromUnknown } from "@/lib/error-codes";
import { storageUrl } from "@/lib/storage";

function safeJsonParse(text: string): Record<string, unknown> {
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

export function publicTask(task: Task) {
  const params = safeJsonParse(task.params);
  return {
    id: task.id,
    taskId: task.remoteTaskId,
    type: task.type,
    status: task.status,
    prompt: task.prompt,
    params,
    inputUrl: storageUrl(task.inputPath),
    outputUrl: storageUrl(task.outputPath),
    error: task.error,
    errorCode: params.errorCode ?? task.error,
    canResume: task.canResume,
    lastProviderStatus: params.lastRemoteStatus ?? null,
    provider: params.provider ?? null,
    estimatedCredits: params.estimatedCredits ?? null,
    actualCredits: params.actualCredits ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/**
 * Type guard: true when the caller owns the task. Legacy tasks with
 * visitorId=null stay visible to everyone so historical records are not lost
 * after the visitor-isolation rollout.
 */
export function ownsTask(task: Task | null, visitorId: string | undefined): task is Task {
  if (!task) return false;
  return !task.visitorId || task.visitorId === visitorId;
}

export type PublicTask = ReturnType<typeof publicTask>;

export type TaskListResponse = {
  items: PublicTask[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export function errorMessage(error: unknown) {
  return errorCodeFromUnknown(error);
}
