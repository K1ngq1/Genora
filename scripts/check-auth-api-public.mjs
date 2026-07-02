import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const middlewarePath = path.join(root, "lib", "supabase", "middleware.ts");
const middleware = readFileSync(middlewarePath, "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(
  middleware.includes('"/api/auth"'),
  "Supabase middleware must keep /api/auth public for signup and password reset email endpoints.",
);

console.log("Auth API public-route check passed.");
