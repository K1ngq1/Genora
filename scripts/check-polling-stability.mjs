import { readFile } from "node:fs/promises";

const [workspace, taskRoute, packageJson] = await Promise.all([
  readFile("app/workspace/page.tsx", "utf8"),
  readFile("app/api/tasks/[id]/route.ts", "utf8"),
  readFile("package.json", "utf8"),
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(workspace.includes("materialLibraryRef"), "material library should be read through a ref when saving");
assert(workspace.includes("libraryItems: materialLibraryRef.current"), "project save payload should not depend on materialLibrary state identity");
assert(!workspace.includes("}, [materialLibrary, reactFlow]);"), "canvasProjectData must not recreate saveProject on material library changes");
assert(taskRoute.includes("isActiveTaskStatus"), "task route should check active status before starting background polling");
assert(taskRoute.includes("task.remoteTaskId && isActiveTaskStatus(task.status)"), "background polling should only start for active remote video tasks");
assert(packageJson.includes("check-polling-stability.mjs"), "npm check should include polling stability checks");

console.log("Polling stability checks passed.");
