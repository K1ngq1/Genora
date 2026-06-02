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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  );
`);
db.close();
console.log(`SQLite initialized: ${dbPath}`);
