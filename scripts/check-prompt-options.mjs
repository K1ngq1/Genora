import assert from "node:assert/strict";
import { combineGenerationPrompts } from "../lib/prompt-options.ts";

const positivePrompts = [
  "A cinematic city street after rain, neon reflections, slow camera movement",
  "A sunlit mountain lake surrounded by pine trees, natural colors",
  "A futuristic product photo on a clean studio background",
];
const negativePrompts = [
  "blurry, low resolution, watermark, distorted anatomy",
  "oversaturated colors, compression artifacts, duplicate objects",
  "text, logo, flicker, unstable camera motion",
];

for (let index = 0; index < 6; index += 1) {
  const positive = positivePrompts[Math.floor(Math.random() * positivePrompts.length)];
  const negative = negativePrompts[Math.floor(Math.random() * negativePrompts.length)];
  assert.ok(positive.trim(), "Positive prompt must not be empty");
  assert.ok(negative.trim(), "Negative prompt must not be empty");
  const combined = combineGenerationPrompts(positive, negative);
  assert.ok(combined.includes(positive));
  assert.ok(combined.includes(negative));
}

console.log("Prompt option checks passed with non-empty randomized positive and negative prompts.");
