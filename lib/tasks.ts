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
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function errorMessage(error: unknown) {
  return errorCodeFromUnknown(error);
}
