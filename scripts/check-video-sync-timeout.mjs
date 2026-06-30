import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sync = await readFile("lib/video-task-sync.ts", "utf8");
const tasks = await readFile("lib/tasks.ts", "utf8");
const workspaceUtils = await readFile("features/workspace/workspace-utils.ts", "utf8");

assert.match(sync, /status:\s*"timeout"/);
assert.match(sync, /error:\s*"Video task timeout"/);
assert.match(sync, /errorCode:\s*"TIMEOUT"/);
assert.match(sync, /canResume:\s*true/);
assert.doesNotMatch(sync, /status:\s*\{\s*in:\s*\[[^\]]*"timeout"/s);
assert.match(sync, /status:\s*\{\s*in:\s*\["pending",\s*"submitting",\s*"queued",\s*"processing",\s*"downloading"\]\s*\}/);
assert.doesNotMatch(sync, /const legacyTimeouts = await db\.task\.findMany/);
assert.doesNotMatch(sync, /legacy-timeout-finalized/);
assert.match(sync, /timedOutAt/);
assert.match(tasks, /errorCode:\s*params\.errorCode\s*\?\?\s*task\.error/);
assert.match(workspaceUtils, /errorCode\s*===\s*"TIMEOUT"\s*\?\s*"已超时"/);
assert.match(workspaceUtils, /localizeError\(errorCode\s*\?\?\s*error\s*\?\?\s*"AGNES_REQUEST_TIMEOUT"\)/);

console.log("Video sync timeout checks passed.");
