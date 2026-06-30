import { readFile } from "node:fs/promises";

const page = await readFile("app/workspace/page.tsx", "utf8");
const utils = await readFile("features/workspace/workspace-utils.ts", "utf8");
const workspaceSource = `${page}\n${utils}`;

const checks = [
  ["loaded task reconciliation", page.includes("reconcileLoadedTaskNodes")],
  ["server task lookup", page.includes("fetch(`/api/tasks/${node.data.taskId}`, { cache: \"no-store\" })")],
  ["completed result recovery", workspaceSource.includes('status === "completed"') && workspaceSource.includes("url: task.outputUrl")],
  ["stale error clearing", workspaceSource.includes('error: ""') && workspaceSource.includes("canResume: false")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Canvas task reconciliation checks passed.");
