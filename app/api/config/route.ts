import { isAgnesConfigured } from "@/lib/agnes";
import { isApimartConfigured } from "@/lib/apimart";
import { APIMART_DEV_IMAGE_MODEL } from "@/lib/apimart-models";
import { isSupabasePublicStorageConfigured } from "@/lib/supabase-storage";

export async function GET() {
  return Response.json({
    agnesConfigured: isAgnesConfigured(),
    agnesPublicImageStorageConfigured: isSupabasePublicStorageConfigured(),
    apimartImageConfigured: isApimartConfigured("image"),
    apimartVideoConfigured: isApimartConfigured("video"),
    apimartDevConfigured: isApimartConfigured("image", APIMART_DEV_IMAGE_MODEL),
  });
}
