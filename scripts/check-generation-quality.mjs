import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getImageSize,
  getVideoDimensions,
  imageQualityFallbacks,
  isQualityRelatedError,
  normalizeGenerationSpec,
  videoQualityFallbacks,
} from "../lib/generation-quality.ts";

assert.equal(getImageSize("4:3", "1k"), "1184x864");
assert.equal(getImageSize("4:3", "2k"), "2368x1728");
assert.equal(getImageSize("3:4", "1k"), "864x1184");
assert.equal(getImageSize("3:4", "2k"), "1728x2368");
assert.equal(getImageSize("16:9", "1k"), "1344x768");
assert.equal(getImageSize("16:9", "2k"), "2688x1536");
assert.equal(getImageSize("9:16", "1k"), "768x1344");
assert.equal(getImageSize("1:1", "2k"), "2048x2048");

assert.deepEqual(imageQualityFallbacks("adaptive"), ["2k", "1k"]);
assert.deepEqual(imageQualityFallbacks("2k"), ["2k", "1k"]);
assert.deepEqual(imageQualityFallbacks("1k"), ["1k"]);
assert.deepEqual(videoQualityFallbacks("1080p"), ["1080p", "720p", "480p"]);
assert.deepEqual(getVideoDimensions("4:3", "720p"), { width: 960, height: 720, finalSize: "960x720", quality: "720p", aspectRatio: "4:3" });

assert.deepEqual(normalizeGenerationSpec({ aspectRatio: "4:3", quality: "hd", kind: "image" }), {
  aspectRatio: "4:3",
  quality: "2k",
  finalSize: "2368x1728",
});
assert.equal(isQualityRelatedError("unsupported resolution: 2k"), true);
assert.equal(isQualityRelatedError("CUDA out of memory"), true);
assert.equal(isQualityRelatedError("invalid size 2368x1728"), true);
assert.equal(isQualityRelatedError("insufficient credits"), false);
assert.equal(isQualityRelatedError("unauthorized API key"), false);
assert.equal(isQualityRelatedError("rate limit"), false);
assert.equal(isQualityRelatedError("moderation rejected"), false);

const imageRoute = await readFile("app/api/images/generate/route.ts", "utf8");
const videoRoute = await readFile("app/api/videos/generate/route.ts", "utf8");
const agnes = await readFile("lib/agnes.ts", "utf8");
const apimartSync = await readFile("lib/apimart-task-sync.ts", "utf8");
assert.match(imageRoute, /body\.aspectRatio \?\? body\.ratio/);
assert.match(imageRoute, /body\.quality \?\? body\.resolution/);
assert.match(videoRoute, /form\.get\("aspectRatio"\)/);
assert.match(videoRoute, /getVideoDimensions\(normalized\.ratio, normalized\.resolution\)/);
assert.match(agnes, /model: "agnes-image-2\.1-flash", prompt, size/);
assert.match(apimartSync, /isQualityRelatedError\(remote\.error\)/);
assert.match(apimartSync, /remoteTaskId: null/);

console.log("generation quality checks passed");
