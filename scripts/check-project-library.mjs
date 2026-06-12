import { readFile } from "node:fs/promises";

const files = {
  schema: await readFile("prisma/schema.prisma", "utf8"),
  package: await readFile("package.json", "utf8"),
  page: await readFile("app/page.tsx", "utf8"),
  projectsApi: await readFile("app/api/projects/route.ts", "utf8").catch(() => ""),
  projectApi: await readFile("app/api/projects/[id]/route.ts", "utf8").catch(() => ""),
  uploadApi: await readFile("app/api/uploads/route.ts", "utf8").catch(() => ""),
  library: await readFile("app/projects/page.tsx", "utf8").catch(() => ""),
};

const checks = [
  ["Prisma Project model", files.schema.includes("model Project")],
  ["project list API", files.projectsApi.includes("export async function GET")],
  ["project create API", files.projectsApi.includes("export async function POST")],
  ["project load API", files.projectApi.includes("export async function GET")],
  ["project save API", files.projectApi.includes("export async function PATCH")],
  ["upload API", files.uploadApi.includes("export async function POST")],
  ["project library page", files.library.includes("作品库")],
  ["Ctrl+S shortcut", files.page.includes('event.key.toLowerCase() !== "s"')],
  ["ten-minute autosave", files.page.includes("10 * 60 * 1000")],
  ["project check script", files.package.includes("check-project-library.mjs")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log("Project library checks passed.");
