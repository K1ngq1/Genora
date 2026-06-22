import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const dbPath = join(process.cwd(), "prisma", "dev.db");
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "remoteTaskId" TEXT,
    "inputPath" TEXT,
    "outputPath" TEXT,
    "error" TEXT,
    "canResume" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );
  CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'empty space',
    "canvasData" TEXT NOT NULL,
    "requiresRename" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastOpenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
`);
db.close();
console.log(`SQLite initialized: ${dbPath}`);
