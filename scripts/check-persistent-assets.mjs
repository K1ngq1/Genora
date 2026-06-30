import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("prisma/schema.prisma", "utf8");
const uploadRoute = await readFile("app/api/uploads/route.ts", "utf8");
const assetRoute = await readFile("app/api/assets/[id]/route.ts", "utf8").catch(() => "");
const projectRoute = await readFile("app/api/projects/[id]/route.ts", "utf8");
const assets = await readFile("lib/assets.ts", "utf8");
const page = await readFile("app/workspace/page.tsx", "utf8");
const workflowNode = await readFile("features/workspace/workflow-node.tsx", "utf8");
const workspaceSource = `${page}\n${workflowNode}`;
const packageJson = await readFile("package.json", "utf8");
const initDb = await readFile("scripts/init-db.mjs", "utf8");

assert.match(schema, /model Asset/);
assert.match(schema, /assets\s+Asset\[\]/);
assert.match(uploadRoute, /projectId/);
assert.match(uploadRoute, /db\.asset\.create/);
assert.match(uploadRoute, /assetUrl\(asset\.id\)/);
assert.match(assetRoute, /db\.asset\.findUnique/);
assert.match(assetRoute, /readFile/);
assert.match(assetRoute, /asset\.byteSize > 0 \? asset\.byteSize : file\.length/);
assert.match(assets, /repairLegacyAssetUrls/);
assert.match(projectRoute, /repairLegacyAssetUrls/);
assert.match(page, /uploadAsset:/);
assert.match(workspaceSource, /data\.uploadAsset\(file\)/);
assert.doesNotMatch(workflowNode.slice(workflowNode.indexOf("function WorkflowNode"), workflowNode.indexOf("export const nodeTypes")), /URL\.createObjectURL\(file\)/);
assert.match(packageJson, /check-persistent-assets\.mjs/);
assert.match(initDb, /CREATE TABLE IF NOT EXISTS "Asset"/);

console.log("Persistent asset checks passed.");
