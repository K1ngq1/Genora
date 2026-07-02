import { createClient } from "@supabase/supabase-js";

// Service-role client for trusted server code (API routes / server actions) only.
// Bypasses RLS. MUST never be imported into a client component or referenced from
// any code that ships to the browser — keep it server-side and never prefix the
// service-role env var with NEXT_PUBLIC_.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role credentials are not configured");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
