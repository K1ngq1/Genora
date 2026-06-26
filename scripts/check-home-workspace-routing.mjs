import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspacePage = path.join(root, "app", "workspace", "page.tsx");
const homePage = path.join(root, "app", "page.tsx");
const projectsPage = path.join(root, "app", "projects", "page.tsx");
const homeOptionsFile = path.join(root, "features", "home", "home-options.ts");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(existsSync(workspacePage), "Expected infinite canvas route at app/workspace/page.tsx");

const [home, homeOptions, workspace, projects] = await Promise.all([
  readFile(homePage, "utf8"),
  readFile(homeOptionsFile, "utf8"),
  readFile(workspacePage, "utf8"),
  readFile(projectsPage, "utf8"),
]);

assert(home.includes("/api/images/generate"), "Home page must call the image generation API");
assert(home.includes("/api/videos/generate"), "Home page must call the video generation API");
assert(home.includes("/api/tasks/"), "Home page must poll generated media tasks");
assert(!home.includes("/api/agent/generate"), "Home page media generation must not call the Agnes text Agent API");
assert(home.includes("href=\"/projects\""), "Home page must link the workspace button to /projects");
assert(!home.includes("href=\"/database\""), "Home page should not show the removed database button");
assert(home.includes("@/features/home/home-options") && homeOptions.includes("MODEL_CATALOG"), "Home page must reuse the shared model catalog");
assert(!home.includes("ReactFlowProvider"), "Home page should not render the infinite canvas directly");
assert(!home.includes("home-header"), "Home page should not keep the old top header");
assert(workspace.includes("ReactFlowProvider"), "Workspace route must render the infinite canvas");
assert(workspace.includes("searchParams.get(\"prompt\")"), "Workspace route must accept a prompt query parameter");
assert(workspace.includes("searchParams.get(\"model\")"), "Workspace route must accept a model query parameter");
assert(workspace.includes("searchParams.get(\"kind\")"), "Workspace route must accept a kind query parameter");
assert(workspace.includes("/workspace?project="), "Workspace route must keep project URLs under /workspace");
assert(projects.includes("/workspace?project="), "Project library must open projects under /workspace");
assert(projects.includes("返回首页"), "Project library back link should return to the home page");

console.log("Home/workspace routing check passed.");
