import { isAgnesConfigured } from "@/lib/agnes";
import { isApimartConfigured } from "@/lib/apimart";
import { APIMART_DEV_IMAGE_MODEL } from "@/lib/apimart-models";

export async function GET() {
  return Response.json({
    agnesConfigured: isAgnesConfigured(),
    apimartImageConfigured: isApimartConfigured("image"),
    apimartVideoConfigured: isApimartConfigured("video"),
    apimartDevConfigured: isApimartConfigured("image", APIMART_DEV_IMAGE_MODEL),
  });
}
