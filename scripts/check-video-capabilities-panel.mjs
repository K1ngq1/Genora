import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const capability = readFileSync("lib/video-model-capabilities.ts", "utf8");
const workspace = [
  readFileSync("app/workspace/page.tsx", "utf8"),
  readFileSync("features/workspace/workflow-node.tsx", "utf8"),
  readFileSync("features/workspace/workspace-types.ts", "utf8"),
].join("\n");
const css = readFileSync("app/workflow.css", "utf8");

assert.match(capability, /videoModelCapabilities/, "video capability map should be centralized");
assert.match(capability, /getVideoModelCapabilities/, "UI should read video capabilities through a helper");
assert.match(capability, /defaultAspectRatio/, "capabilities should define default aspect ratio");
assert.match(capability, /defaultResolution/, "capabilities should define default resolution");
assert.match(capability, /defaultDuration/, "capabilities should define default duration");
assert.match(capability, /supportsFirstLastFrame/, "capabilities should expose first/last-frame support");
assert.match(capability, /supportsReferenceImages/, "capabilities should expose reference image support");
assert.match(capability, /maxReferenceImages/, "capabilities should limit reference image count");

assert.match(workspace, /getVideoModelCapabilities/, "workspace should use video capabilities");
assert.match(workspace, /video-settings-summary/, "bottom settings capsule should show a live summary");
assert.match(workspace, /video-mode-options/, "video mode options should render inside the panel");
assert.match(workspace, /sanitizeVideoOptionsForModel/, "workspace should sanitize unsupported video options");
assert.match(workspace, /filter\(\(mode\) => mode !== "text"\)/, "video mode selector should hide text-only mode");
assert.match(workspace, /referenceFrameUrls/, "workspace should preserve uploaded reference images");
assert.match(workspace, /frame-tooltip/, "frame upload buttons should use hover tooltips");
assert.match(workspace, /reference-frame-grid/, "reference mode should render multiple thumbnails");

assert.doesNotMatch(workspace, /generateAudio|enableAudio|audioEnabled|生成音频/, "workspace must not expose audio generation state");
assert.doesNotMatch(css, /audio/i, "video parameter panel CSS should not include audio controls");
assert.doesNotMatch(workspace, /videoSettingsSummary && <span>\{videoSettingsSummary\}<\/span>/, "toolbar should not duplicate the video settings summary");
assert.match(css, /prompt-toolbar .*height:42px/, "toolbar capsules should share a consistent height");
assert.match(css, /frame-tooltip/, "frame upload tooltip should be styled");

console.log("video capabilities panel checks passed");
