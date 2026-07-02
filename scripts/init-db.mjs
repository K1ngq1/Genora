import { DatabaseSync } from "node:sqlite";
import { mkdirSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const dbPath = join(process.cwd(), "prisma", "dev.db");
mkdirSync(dirname(dbPath), { recursive: true });

// 重建数据库（本地开发用，生产环境需用 Prisma Migrate）
if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log("Deleted existing dev.db");
}
const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "remoteTaskId" TEXT,
    "inputPath" TEXT,
    "outputPath" TEXT,
    "error" TEXT,
    "canResume" BOOLEAN NOT NULL DEFAULT false,
    "visitorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );
  CREATE INDEX IF NOT EXISTS "Task_userId_idx" ON "Task"("userId");

  CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'empty space',
    "canvasData" TEXT NOT NULL,
    "requiresRename" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastOpenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");

  CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "projectId" TEXT,
    "nodeId" TEXT,
    "taskId" TEXT,
    "path" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Asset_path_key" ON "Asset"("path");
  CREATE INDEX IF NOT EXISTS "Asset_projectId_idx" ON "Asset"("projectId");
  CREATE INDEX IF NOT EXISTS "Asset_userId_idx" ON "Asset"("userId");
`);
// visitorId column for anonymous task isolation (added after the initial
// rollout — CREATE TABLE IF NOT EXISTS will not add it to pre-existing DBs).
try {
  db.exec(`ALTER TABLE "Task" ADD COLUMN "visitorId" TEXT;`);
} catch (err) {
  const msg = String((err && err.message) || "");
  if (!/duplicate column/i.test(msg)) throw err;
}
db.exec(`CREATE INDEX IF NOT EXISTS "Task_visitorId_createdAt_idx" ON "Task"("visitorId", "createdAt");`);

db.close();
console.log(`SQLite initialized: ${dbPath}`);
