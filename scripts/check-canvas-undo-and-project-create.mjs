import { readFile } from "node:fs/promises";

const canvas = await readFile("app/workspace/page.tsx", "utf8");
const projects = await readFile("app/projects/page.tsx", "utf8");
const projectsCss = await readFile("app/projects/projects.css", "utf8");

const checks = [
  ["deleted node history stack", canvas.includes("deletedCanvasStackRef")],
  ["undo deleted node action", canvas.includes("restoreDeletedCanvas")],
  ["undo keyboard shortcut", canvas.includes('event.key.toLowerCase() === "z"')],
  ["undo toolbar button removed", !canvas.includes('aria-label="撤回删除节点"')],
  ["header create button removed", !projects.includes('className="projects-create"')],
  ["first grid create card", projects.includes('className="project-create-card"')],
  ["create card before project map", projects.indexOf('className="project-create-card"') < projects.indexOf("projects.map")],
  ["create card styling", projectsCss.includes(".project-create-card")],
  ["project preview uses 16:9 ratio", projectsCss.includes(".project-preview{") && projectsCss.includes("aspect-ratio:16/9")],
  ["project card uses 16:9 ratio", projectsCss.includes(".project-card{") && projectsCss.includes("aspect-ratio:16/9")],
  ["create card uses 16:9 ratio", projectsCss.includes(".project-create-card{") && projectsCss.includes("aspect-ratio:16/9")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Canvas undo and project create checks passed.");
