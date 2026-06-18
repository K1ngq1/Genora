import { isAgnesConfigured } from "@/lib/agnes";
import { isApimartConfigured } from "@/lib/apimart";

export async function GET() {
  return Response.json({
    agnesConfigured: isAgnesConfigured(),
    apimartImageConfigured: isApimartConfigured("image"),
    apimartVideoConfigured: isApimartConfigured("video"),
  });
}
