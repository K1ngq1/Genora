import assert from "node:assert/strict";
import {
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_POLL_MAX_ATTEMPTS,
  VIDEO_POLL_MAX_DURATION_MS,
} from "../lib/video-polling.ts";

assert.equal(VIDEO_POLL_INTERVAL_MS, 3_000);
assert.equal(VIDEO_POLL_MAX_DURATION_MS, 30 * 60_000);
assert.equal(VIDEO_POLL_MAX_ATTEMPTS, 600);
assert.equal(VIDEO_POLL_INTERVAL_MS * VIDEO_POLL_MAX_ATTEMPTS, VIDEO_POLL_MAX_DURATION_MS);

console.log("Video polling checks passed.");
