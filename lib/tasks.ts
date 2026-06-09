import type { Task } from "@/generated/prisma";
import { errorCodeFromUnknown } from "@/lib/error-codes";
import { storageUrl } from "@/lib/storage";

export function publicTask(task: Task) {
  return {
    id: task.id,
    taskId: task.remoteTaskId,
    type: task.type,
    status: task.status,
    prompt: task.prompt,
    params: JSON.parse(task.params),
    inputUrl: storageUrl(task.inputPath),
    outputUrl: storageUrl(task.outputPath),
    error: task.error,
    errorCode: task.error,
    canResume: task.canResume,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function errorMessage(error: unknown) {
  return errorCodeFromUnknown(error);
}