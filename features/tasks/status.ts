export const TASK_STATUSES = [
  "pending",
  "submitting",
  "queued",
  "processing",
  "downloading",
  "completed",
  "failed",
  "cancelled",
  "timeout",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ACTIVE_TASK_STATUSES = ["pending", "submitting", "queued", "processing", "downloading"] as const satisfies readonly TaskStatus[];
export const TERMINAL_TASK_STATUSES = ["completed", "failed", "cancelled", "timeout"] as const satisfies readonly TaskStatus[];

export function isActiveTaskStatus(status: string): status is (typeof ACTIVE_TASK_STATUSES)[number] {
  return (ACTIVE_TASK_STATUSES as readonly string[]).includes(status);
}

export function isTerminalTaskStatus(status: string): status is (typeof TERMINAL_TASK_STATUSES)[number] {
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(status);
}
