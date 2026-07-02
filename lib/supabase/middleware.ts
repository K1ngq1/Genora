import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Public routes must stay reachable even before Supabase env vars are configured.
  // `/` is public so logged-out visitors land on the home page; the home UI opens
  // a login dialog when auth is required for an action.
  const publicPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/terms", "/privacy", "/api/config", "/_next", "/favicon.ico"];
  const isPublicPath = publicPaths.some(
    (path) =>
      request.nextUrl.pathname === path ||
      request.nextUrl.pathname.startsWith(path + "/"),
  );

  if (isPublicPath) {
    return supabaseResponse;
  }

  // Mock auth cookie (set by the client AuthProvider) grants page-route access so
  // the demo session can reach /workspace and /projects. Real /api routes still
  // require a genuine Supabase session via getUserId.
  if (request.cookies.get("genora-mock-auth")?.value === "1") {
    return supabaseResponse;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 刷新 session（重要：防止过期）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未认证且访问受保护路由 → 重定向到登录页
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
