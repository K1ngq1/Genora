import type { Task } from "@prisma/client";
import { errorCodeFromUnknown } from "@/lib/error-codes";
import { storageUrl } from "@/lib/storage";

export function publicTask(task: Task) {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    prompt: task.prompt,
    params: JSON.parse(task.params),
    inputUrl: storageUrl(task.inputPath),
    outputUrl: storageUrl(task.outputPath),
    error: task.error,
    errorCode: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function errorMessage(error: unknown) {
  return errorCodeFromUnknown(error);
}
