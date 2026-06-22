import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createApimartImage,
  createApimartVideo,
  downloadApimartFile,
  getApimartTask,
  uploadApimartImage,
} from "../lib/apimart.ts";
import { saveBuffer } from "../lib/storage.ts";
import {
  APIMART_DEV_IMAGE_MODEL,
  APIMART_DEV_VIDEO_MODEL,
} from "../lib/apimart-models.ts";

if (process.env.APIMART_LIVE_TEST !== "1") {
  console.log("APIMart live test disabled. Set APIMART_LIVE_TEST=1 to submit exactly one image and one video task.");
  process.exit(0);
}
if (!process.env.APIMART_KEY_DEV?.trim()) throw new Error("MISSING_APIMART_DEV_KEY");

const POLL_MS = 5_000;
const MAX_POLLS = 120;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForTask(taskId, service, model) {
  for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
    const task = await getApimartTask(taskId, service, model);
    console.log(`[${service}] task=${taskId} status=${task.status} credits=${task.creditsCost ?? "pending"}`);
    if (task.status === "completed") {
      if (!task.outputUrl) throw new Error(`${service}: APIMART_RESULT_MISSING`);
      return task;
    }
    if (task.status === "failed" || task.status === "cancelled") throw new Error(`${service}: ${task.error ?? "APIMART_TASK_FAILED"}`);
    await wait(POLL_MS);
  }
  throw new Error(`${service}: TASK_POLL_TIMEOUT`);
}

async function downloadResult(url, folder, filename) {
  return saveBuffer(folder, filename, await downloadApimartFile(url));
}

const results = [];

try {
  const referencePath = process.env.APIMART_TEST_IMAGE_PATH?.trim();
  const imageUrls = [];
  if (referencePath) {
    const bytes = await readFile(referencePath);
    imageUrls.push(await uploadApimartImage(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      path.basename(referencePath),
      "image",
      APIMART_DEV_IMAGE_MODEL,
    ));
  }
  const imageTaskId = await createApimartImage({
    model: APIMART_DEV_IMAGE_MODEL,
    prompt: referencePath
      ? "Preserve the main subject and composition, refine it into a clean cinematic illustration."
      : "A small paper crane on a dark glass desk, soft cinematic light, minimal composition.",
    ratio: "1:1",
    resolution: "1k",
    imageUrls,
  });
  console.log(`[image] submitted task=${imageTaskId}`);
  const imageTask = await waitForTask(imageTaskId, "image", APIMART_DEV_IMAGE_MODEL);
  const outputPath = await downloadResult(imageTask.outputUrl, "images", `apimart-live-${imageTaskId}.png`);
  results.push({ service: "image", taskId: imageTaskId, outputPath, credits: imageTask.creditsCost });
} catch (error) {
  results.push({ service: "image", error: error instanceof Error ? error.message : String(error) });
}

try {
  const videoTaskId = await createApimartVideo({
    model: APIMART_DEV_VIDEO_MODEL,
    prompt: "A small paper crane gently turning on a dark glass desk, subtle cinematic light, static camera.",
    ratio: "16:9",
    resolution: "480p",
    duration: 6,
  });
  console.log(`[video] submitted task=${videoTaskId}`);
  const videoTask = await waitForTask(videoTaskId, "video", APIMART_DEV_VIDEO_MODEL);
  const outputPath = await downloadResult(videoTask.outputUrl, "videos", `apimart-live-${videoTaskId}.mp4`);
  results.push({ service: "video", taskId: videoTaskId, outputPath, credits: videoTask.creditsCost });
} catch (error) {
  results.push({ service: "video", error: error instanceof Error ? error.message : String(error) });
}

console.log(JSON.stringify(results, null, 2));
if (results.some((result) => result.error)) process.exitCode = 1;
