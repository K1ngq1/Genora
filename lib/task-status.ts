export type TaskStatus = "pending" | "queued" | "processing" | "downloading" | "completed" | "failed" | "cancelled" | "timeout";

export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["pending", "queued", "processing", "downloading"];

export function isActiveTaskStatus(status: string) {
  return ACTIVE_TASK_STATUSES.includes(status as TaskStatus);
}