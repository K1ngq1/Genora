import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const tasks = await db.task.findMany();
console.log(`Prisma task read ok: ${tasks.length}`);
await db.$disconnect();
