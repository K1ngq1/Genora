import assert from "node:assert/strict";
import { ERROR_MESSAGES_ZH } from "../lib/error-codes.ts";

const requiredMessages = [
  "AGNES_SERVICE_BUSY",
  "AGNES_VIDEO_FAILED",
  "AGNES_VIDEO_TIMEOUT",
  "AGNES_VIDEO_POLL_TIMEOUT",
  "TASK_POLL_TIMEOUT",
  "AGNES_VIDEO_MISSING_URL",
  "AGNES_VIDEO_RESULT_DOWNLOAD_FAILED",
  "VIDEO_SOURCE_IMAGE_URL_MISSING",
];

for (const code of requiredMessages) {
  const message = ERROR_MESSAGES_ZH[code];
  assert.ok(message, `${code} must have a localized message`);
  assert.match(message, /阶段：/, `${code} must identify the processing stage`);
  assert.match(message, /原因：/, `${code} must explain the cause`);
  assert.match(message, /建议：/, `${code} must provide a next action`);
}

assert.notEqual(
  ERROR_MESSAGES_ZH.AGNES_VIDEO_FAILED,
  ERROR_MESSAGES_ZH.AGNES_VIDEO_RESULT_DOWNLOAD_FAILED,
  "Generation failure and result transfer failure must remain distinct",
);

console.log("Error message checks passed.");
