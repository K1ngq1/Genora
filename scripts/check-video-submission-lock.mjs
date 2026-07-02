import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runner = await readFile(new URL("../lib/video-task-runner.ts", import.meta.url), "utf8");
const taskRoute = await readFile(new URL("../app/api/tasks/[id]/route.ts", import.meta.url), "utf8");
const generateRoute = await readFile(new URL("../app/api/videos/generate/route.ts", import.meta.url), "utf8");
const agnes = await readFile(new URL("../services/providers/agnes-adapter.ts", import.meta.url), "utf8");

assert.match(generateRoute, /status:\s*"pending"/);
assert.match(runner, /updateMany\(\{[\s\S]*status:\s*"pending"[\s\S]*status:\s*"submitting"/);
assert.match(taskRoute, /task\.status === "pending"/);
assert.match(taskRoute, /Cache-Control": "no-store"/);
assert.match(agnes, /AGNES_VIDEO_CREATE_TIMEOUT_MS/);

console.log("Video submission lock checks passed.");
