import { isAgnesConfigured } from "@/lib/agnes";

export async function GET() {
  return Response.json({
    agnesConfigured: isAgnesConfigured(),
  });
}