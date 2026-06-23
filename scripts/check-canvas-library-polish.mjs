import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getAdaptiveMediaLayout } from "../lib/node-media-layout.ts";

const [page, css, catalog, runner, projectApi, projectsPage] = await Promise.all([
  readFile("app/workspace/page.tsx", "utf8"),
  readFile("app/workflow.css", "utf8"),
  readFile("lib/model-catalog.ts", "utf8"),
  readFile("lib/image-task-runner.ts", "utf8"),
  readFile("app/api/projects/[id]/route.ts", "utf8"),
  readFile("app/projects/page.tsx", "utf8"),
]);

assert.deepEqual(getAdaptiveMediaLayout(1600, 900), { aspectRatio: 16 / 9, width: 520 });
assert.deepEqual(getAdaptiveMediaLayout(900, 1600), { aspectRatio: 9 / 16, width: 260 });
assert.deepEqual(getAdaptiveMediaLayout(1000, 1000), { aspectRatio: 1, width: 340 });
assert.deepEqual(getAdaptiveMediaLayout(0, 0), { aspectRatio: 1, width: 340 });

assert.doesNotMatch(catalog, /ideogram/i);
assert.doesNotMatch(runner, /ideogram/i);
assert.doesNotMatch(page, /\(\["apimart", "legacy"\]|现有模型/);
assert.match(page, /useUpdateNodeInternals/);
assert.match(page, /onLoadedMetadata/);
assert.match(css, /--media-aspect/);
assert.match(css, /backdrop-filter:blur\(30px\)/);
assert.match(projectApi, /export async function DELETE/);
assert.match(projectsPage, /确认删除项目/);
assert.match(projectsPage, /method: "DELETE"/);

console.log("Canvas and project library polish checks passed.");
