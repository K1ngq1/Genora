import { fileURLToPath } from "node:url";

const BASE = "http://localhost:3000";
const POLL_INTERVAL = 5000;
const MAX_ATTEMPTS = 180;

async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

async function main() {
  console.log("[Genora] 开始视频生成测试...\n");

  const form = new FormData();
  form.set("prompt", "a cinematic shot of a cat walking through a neon-lit Tokyo alley at night, rain on the ground, reflections, slow camera push-in");
  form.set("width", "1024");
  form.set("height", "576");
  form.set("numFrames", "25");
  form.set("quality", "720p");

  console.log("[1] 提交视频任务...");
  const submitRes = await fetch(`${BASE}/api/videos/generate`, { method: "POST", body: form });
  const submitBody = await readJson(submitRes);

  if (!submitRes.ok) {
    console.log(`  FAIL: HTTP ${submitRes.status}`);
    console.log(`  ${JSON.stringify(submitBody)}`);
    process.exit(1);
  }

  const taskId = submitBody.id;
  const remoteTaskId = submitBody.taskId;
  console.log(`  OK: taskId=${taskId}`);
  console.log(`  remoteTaskId=${remoteTaskId}`);

  console.log(`\n[2] 轮询任务状态 (每 ${POLL_INTERVAL / 1000} 秒，最多 ${MAX_ATTEMPTS} 次)...`);
  let finalStatus = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const pollRes = await fetch(`${BASE}/api/tasks/${taskId}`);
    const task = await readJson(pollRes);

    const status = task.status;
    const elapsed = Math.round((attempt + 1) * POLL_INTERVAL / 1000);
    const progressStr = typeof task.progress === "number" ? ` | progress=${task.progress}%` : "";
    const remoteStr = task.remoteStatus ? ` | remote=${task.remoteStatus}` : "";
    console.log(`  [${elapsed}s] status=${status}${remoteStr}${progressStr}`);

    if (["completed", "cancelled", "failed", "timeout"].includes(status)) {
      finalStatus = status;
      if (status === "completed" && task.outputUrl) {
        console.log(`\n  SUCCESS: video ready at ${task.outputUrl}`);
      } else if (task.error || task.errorCode) {
        console.log(`\n  ${status}: ${task.errorCode || task.error}`);
      }
      if (task.canResume) {
        console.log(`  canResume=true — 可在 UI 中点击"继续查询"恢复`);
      }
      break;
    }
  }

  if (!finalStatus) {
    console.log(`\n  TIMEOUT: 轮询 ${MAX_ATTEMPTS} 次后仍未完成`);
  }

  console.log(`\n[3] 测试完成。`);
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exit(1);
});