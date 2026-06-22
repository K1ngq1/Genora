import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const imageRoute = await readFile("app/api/images/generate/route.ts", "utf8");
assert.match(imageRoute, /"data:"/);
const videoRoute = await readFile("app/api/videos/generate/route.ts", "utf8");
const imageRunner = await readFile("lib/image-task-runner.ts", "utf8");
const videoRunner = await readFile("lib/video-task-runner.ts", "utf8");
const taskRoute = await readFile("app/api/tasks/[id]/route.ts", "utf8");
const tasks = await readFile("lib/tasks.ts", "utf8");
const config = await readFile("app/api/config/route.ts", "utf8");

assert.match(imageRoute, /model\.provider/);
assert.match(imageRoute, /"apimart"/);
assert.match(imageRoute, /scheduleImageTask/);
assert.match(videoRoute, /model/);
assert.match(videoRoute, /estimatedCredits/);
assert.match(imageRunner, /createApimartImage/);
assert.match(imageRunner, /providerErrorDetail/);
assert.match(videoRunner, /createApimartVideo/);
assert.match(videoRunner, /providerErrorDetail/);
assert.match(taskRoute, /syncApimartTask/);
assert.match(tasks, /actualCredits/);
assert.match(tasks, /estimatedCredits/);
assert.match(config, /apimartImageConfigured/);
assert.match(config, /apimartVideoConfigured/);

console.log("APIMart task flow checks passed.");
