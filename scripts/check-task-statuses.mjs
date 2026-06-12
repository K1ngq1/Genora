import assert from "node:assert/strict";
import {
  ACTIVE_TASK_STATUSES,
  TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  isActiveTaskStatus,
  isTerminalTaskStatus,
} from "../lib/task-status.ts";

assert.deepEqual(TASK_STATUSES, [
  "pending",
  "submitting",
  "queued",
  "processing",
  "downloading",
  "completed",
  "failed",
  "cancelled",
  "timeout",
]);
assert.ok(ACTIVE_TASK_STATUSES.every(isActiveTaskStatus));
assert.ok(TERMINAL_TASK_STATUSES.every(isTerminalTaskStatus));
assert.equal(isActiveTaskStatus("completed"), false);
assert.equal(isTerminalTaskStatus("processing"), false);

console.log("Task status checks passed.");
