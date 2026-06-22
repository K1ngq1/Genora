import { createSupabasePublicStorage, supabasePublicStorageConfig } from "../lib/supabase-storage.ts";

const config = supabasePublicStorageConfig();
const storage = createSupabasePublicStorage(config);
await storage.ensurePublicBucket();
console.log(`Supabase Storage bucket ready: ${config.bucket}`);
