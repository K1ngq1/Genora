import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("app/page.tsx", "utf8");
const css = await readFile("app/workflow.css", "utf8");

assert.match(page, /modelsForKind/);
assert.match(page, /modelCapabilityLabel/);
assert.match(page, /estimateCredits/);
assert.match(page, /materializeReferenceUrl/);
assert.match(page, /APIMART_INSUFFICIENT_CREDITS/);
assert.match(page, /className="model-trigger"/);
assert.match(page, /className="model-menu"/);
assert.match(page, /availableModels\.map/);
assert.doesNotMatch(page, /现有模型/);
assert.match(page, /预计/);
assert.match(page, /Free/);
assert.match(page, /model: kind === "image" \? "gpt-image-2" : kind === "video" \? "kling-v3-omni"/);
assert.match(page, /ratio: kind === "video" \? "16:9" : "1:1"/);
assert.match(page, /quality: kind === "video" \? "720p" : "1k"/);
assert.match(css, /\.model-menu/);
assert.match(css, /overflow-y:auto/);
assert.match(css, /backdrop-filter:blur/);
assert.match(css, /\.generation-cost/);

console.log("APIMart canvas UI checks passed.");
