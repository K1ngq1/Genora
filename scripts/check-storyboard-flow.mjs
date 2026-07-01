import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const workspace = [
  "app/workspace/page.tsx",
  "features/workspace/workflow-node.tsx",
  "features/workspace/workspace-types.ts",
  "features/workspace/workspace-constants.ts",
  "features/workspace/workspace-utils.ts",
].map((file) => readFileSync(file, "utf8")).join("\n");
const css = readFileSync("app/workflow.css", "utf8");
const apiPath = "app/api/storyboards/generate/route.ts";

assert.ok(existsSync(apiPath), "storyboard generation API route should exist");
const api = readFileSync(apiPath, "utf8");

assert.match(workspace, /type StoryboardShot/, "workspace should define storyboard shot data");
assert.match(workspace, /"storyboard"/, "workspace Kind should include storyboard nodes");
assert.match(workspace, /storyboardShots\?: StoryboardShot\[\]/, "WorkData should persist storyboard shots");
assert.match(workspace, /generateStoryboard/, "text nodes should expose storyboard generation action");
assert.match(workspace, /storyboard-node-table/, "storyboard node should render an editable table");
assert.match(workspace, /draggable/, "storyboard rows should be draggable");
assert.match(workspace, /application\/x-genora-storyboard-shot/, "drag payload should identify storyboard shots");
assert.match(workspace, /createVideoFromStoryboardShot/, "dropping a shot should create a video node");
assert.match(workspace, /sourceStoryboardShotId/, "created video nodes should remember their source shot");

assert.match(api, /generateAgnesText/, "storyboard API should reuse the existing Agnes text model");
assert.match(api, /JSON/, "storyboard API should request and parse structured JSON");
assert.match(api, /storyboardShots/, "storyboard API should return storyboardShots");

assert.match(css, /storyboard-node-table/, "storyboard table should have dedicated styling");

console.log("storyboard flow checks passed");
