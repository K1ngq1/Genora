import assert from "node:assert/strict";
import {
  apimartKeyEnv,
  buildApimartImagePayload,
  buildApimartVideoPayload,
  extractApimartTaskId,
  parseApimartTask,
  sanitizeApimartDetail,
} from "../lib/apimart.ts";

assert.equal(
  sanitizeApimartDetail('Authentication failed token sk-secret-value Bearer abcdefghijklmnop'),
  "Authentication failed token [REDACTED] Bearer [REDACTED]",
);

assert.equal(apimartKeyEnv("image", "gpt-image-2-official"), "APIMART_KEY_DEV");
assert.equal(apimartKeyEnv("video", "grok-imagine-1.5-video-apimart"), "APIMART_KEY_DEV");
assert.equal(apimartKeyEnv("video", "doubao-seedance-2.0"), "APIMART_KEY_VIDEO");

assert.deepEqual(
  buildApimartImagePayload({
    model: "gpt-image-2-official",
    prompt: "lowest-cost image test",
    ratio: "1:1",
    resolution: "1k",
  }),
  {
    model: "gpt-image-2-official",
    prompt: "lowest-cost image test",
    size: "1:1",
    resolution: "1k",
    n: 1,
  },
);

assert.deepEqual(
  buildApimartImagePayload({
    model: "gpt-image-2",
    prompt: "test image",
    ratio: "16:9",
    resolution: "2k",
    imageUrls: ["https://upload.apimart.ai/reference.png"],
  }),
  {
    model: "gpt-image-2",
    prompt: "test image",
    size: "16:9",
    resolution: "2k",
    n: 1,
    image_urls: ["https://upload.apimart.ai/reference.png"],
  },
);

assert.deepEqual(
  buildApimartVideoPayload({
    model: "doubao-seedance-2.0",
    prompt: "test video",
    ratio: "4:3",
    resolution: "1080p",
    duration: 8,
    startFrameUrl: "https://upload.apimart.ai/start.png",
    endFrameUrl: "https://upload.apimart.ai/end.png",
  }),
  {
    model: "doubao-seedance-2.0",
    prompt: "test video",
    size: "4:3",
    resolution: "1080p",
    duration: 8,
    generate_audio: false,
    image_with_roles: [
      { url: "https://upload.apimart.ai/start.png", role: "first_frame" },
      { url: "https://upload.apimart.ai/end.png", role: "last_frame" },
    ],
  },
);

assert.deepEqual(
  buildApimartVideoPayload({
    model: "grok-imagine-1.5-video-apimart",
    prompt: "lowest-cost video test",
    ratio: "16:9",
    resolution: "480p",
    duration: 6,
  }),
  {
    model: "grok-imagine-1.5-video-apimart",
    prompt: "lowest-cost video test",
    size: "16:9",
    duration: 6,
    quality: "480p",
  },
);

assert.deepEqual(
  buildApimartVideoPayload({
    model: "kling-v3-omni",
    prompt: "test video",
    negativePrompt: "blur",
    ratio: "16:9",
    resolution: "1080p",
    duration: 5,
  }),
  {
    model: "kling-v3-omni",
    prompt: "test video",
    negative_prompt: "blur",
    mode: "pro",
    duration: 5,
    aspect_ratio: "16:9",
  },
);

assert.deepEqual(
  buildApimartVideoPayload({
    model: "happyhorse-1.0",
    prompt: "test video",
    ratio: "9:16",
    resolution: "720p",
    duration: 6,
    startFrameUrl: "https://upload.apimart.ai/start.png",
  }),
  {
    model: "happyhorse-1.0",
    prompt: "test video",
    resolution: "720P",
    duration: 6,
    first_frame_image: "https://upload.apimart.ai/start.png",
  },
);

assert.equal(extractApimartTaskId({ code: 200, data: [{ status: "submitted", task_id: "task_123" }] }), "task_123");
assert.deepEqual(
  parseApimartTask({
    code: 200,
    data: {
      id: "task_123",
      status: "completed",
      credits_cost: 1.25,
      result: { videos: [{ url: "https://upload.apimart.ai/result.mp4" }] },
    },
  }),
  { status: "completed", creditsCost: 1.25, outputUrl: "https://upload.apimart.ai/result.mp4", error: undefined },
);

console.log("APIMart payload checks passed.");
