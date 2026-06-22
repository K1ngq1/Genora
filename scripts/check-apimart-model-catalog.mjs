import assert from "node:assert/strict";
import {
  estimateCredits,
  getModelDefinition,
  normalizeModelOptions,
} from "../lib/model-catalog.ts";

const gemini = getModelDefinition("gemini-2.5-flash-image-preview");
assert.equal(gemini.provider, "apimart");
assert.deepEqual(gemini.resolutions, ["1k"]);
assert.equal(estimateCredits({ model: gemini.id, resolution: "1k", duration: 0, hasImageInput: false }), 0.125);

const gptImage = getModelDefinition("gpt-image-2");
assert.deepEqual(gptImage.resolutions, ["1k", "2k", "4k"]);
assert.equal(estimateCredits({ model: gptImage.id, resolution: "4k", duration: 0, hasImageInput: false }), 0.18);

const gptImageOfficial = getModelDefinition("gpt-image-2-official");
assert.equal(gptImageOfficial.provider, "apimart");
assert.equal(gptImageOfficial.keyScope, "dev");
assert.deepEqual(gptImageOfficial.resolutions, ["1k"]);
assert.equal(estimateCredits({ model: gptImageOfficial.id, resolution: "1k", duration: 0, hasImageInput: false }), 0.0488);
assert.equal(estimateCredits({ model: gptImageOfficial.id, resolution: "1k", duration: 0, hasImageInput: true }), 0.08508);

const seedance = getModelDefinition("doubao-seedance-2.0");
assert.equal(estimateCredits({ model: seedance.id, resolution: "720p", duration: 5, hasImageInput: false }), 7.808);
assert.equal(estimateCredits({ model: seedance.id, resolution: "720p", duration: 5, hasImageInput: true }), 4.72);

const kling = getModelDefinition("kling-v3-omni");
assert.deepEqual(kling.ratios, ["1:1", "16:9", "9:16"]);
assert.deepEqual(kling.resolutions, ["720p", "1080p"]);
assert.deepEqual(
  normalizeModelOptions(kling.id, { ratio: "4:3", resolution: "480p", duration: 18 }),
  { ratio: "16:9", resolution: "720p", duration: 15 },
);
assert.equal(estimateCredits({ model: kling.id, resolution: "1080p", duration: 5, hasImageInput: false }), 4.48);

const happyhorse = getModelDefinition("happyhorse-1.0");
assert.equal(happyhorse.supportsEndFrame, false);
assert.equal(estimateCredits({ model: happyhorse.id, resolution: "720p", duration: 5, hasImageInput: false }), 6.5);

const grokVideo = getModelDefinition("grok-imagine-1.5-video-apimart");
assert.equal(grokVideo.keyScope, "dev");
assert.deepEqual(grokVideo.resolutions, ["480p", "720p"]);
assert.deepEqual(
  normalizeModelOptions(grokVideo.id, { ratio: "4:3", resolution: "1080p", duration: 3 }),
  { ratio: "16:9", resolution: "480p", duration: 6 },
);
assert.equal(estimateCredits({ model: grokVideo.id, resolution: "480p", duration: 6, hasImageInput: false }), 0.42);

const agnes = getModelDefinition("agnes-image-2.1-flash");
assert.equal(agnes.free, true);
assert.equal(estimateCredits({ model: agnes.id, resolution: "1k", duration: 0, hasImageInput: false }), 0);

console.log("APIMart model catalog checks passed.");
