import assert from "node:assert/strict";
import { ERROR_MESSAGES_ZH } from "../lib/error-codes.ts";

const requiredMessages = [
  "AGNES_SERVICE_BUSY",
  "AGNES_VIDEO_FAILED",
  "AGNES_VIDEO_TIMEOUT",
  "TASK_POLL_TIMEOUT",
  "AGNES_VIDEO_MISSING_URL",
  "DOWNLOAD_FAILED",
];

for (const code of requiredMessages) {
  const message = ERROR_MESSAGES_ZH[code];
  assert.ok(message, `${code} must have a localized message`);
  assert.ok(message.length >= 8, `${code} must provide a useful localized message`);
  assert.notEqual(message, code, `${code} must not expose the raw error code as its message`);
}

assert.notEqual(
  ERROR_MESSAGES_ZH.AGNES_VIDEO_FAILED,
  ERROR_MESSAGES_ZH.DOWNLOAD_FAILED,
  "Generation failure and result transfer failure must remain distinct",
);

console.log("Error message checks passed.");
