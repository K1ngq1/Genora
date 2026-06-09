import assert from "node:assert/strict";
import {
  VIDEO_FRAME_RATE,
  encodeAgnesImage,
  normalizeVideoFrameCount,
} from "../lib/video-options.ts";

assert.equal(VIDEO_FRAME_RATE, 24);
assert.equal(normalizeVideoFrameCount(1), 25);
assert.equal(normalizeVideoFrameCount(5), 25);
assert.equal(normalizeVideoFrameCount(30), 33);
assert.equal(normalizeVideoFrameCount(999), 441);
assert.equal(
  encodeAgnesImage(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"),
  "data:image/jpeg;base64,/9j/",
);

console.log("Video option checks passed.");
