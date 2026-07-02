import type { TaskStatus as KnownTaskStatus } from "@/lib/task-status";

type PublicTaskStatus = KnownTaskStatus | string;

export type PublicTaskResponse = {
  id?: string;
  taskId?: string;
  type?: string;
  status?: PublicTaskStatus;
  outputUrl?: string;
  error?: string;
  errorCode?: string;
  syncError?: string | null;
};

export async function readJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("READ_FILE_FAILED"));
    reader.readAsDataURL(file);
  });
}
