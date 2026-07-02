"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthError, User } from "@supabase/supabase-js";
import { createClient as getBrowserClient } from "@/lib/supabase/client";
import {
  addAccount,
  deriveName,
  findAccount,
  hashPassword,
  type AuthAccount,
} from "@/features/auth/auth-validation";

// Dual-mode auth: when Supabase env vars are configured, login/register go
// through real supabase.auth; otherwise it falls back to the localStorage mock
// account database. Both paths share the same useAuth() surface.

export type AuthUser = { email: string; name: string };
export type AuthIntent = "login" | "submit" | "workspace" | "canvas" | "account";
export type AuthResult = { ok: boolean; error?: string; awaitOtp?: boolean };

type AuthContextValue = {
  user: AuthUser | null;
  isAuthed: boolean;
  hydrated: boolean;
  dialogOpen: boolean;
  intent: AuthIntent;
  isMockMode: boolean;
  openAuthDialog: (intent?: AuthIntent) => void;
  closeAuthDialog: () => void;
  requireAuth: (intent?: AuthIntent) => boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, name?: string) => Promise<AuthResult>;
  verifySignupOtp: (email: string, password: string, name: string, token: string) => Promise<AuthResult>;
  resendSignupOtp: (email: string) => Promise<AuthResult>;
  logout: () => void;
};

const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const USER_KEY = "genora.auth.user";
const GUEST_KEY = "genora.auth.guest";
const MOCK_COOKIE = "genora-mock-auth";
const DEMO_EMAIL = "demo@genora.ai";
const DEMO_PASSWORD = "demo123";
const DEMO_USER: AuthUser = { email: DEMO_EMAIL, name: "演示用户" };

const AuthContext = createContext<AuthContextValue | null>(null);

function readUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed || typeof parsed.email !== "string" || typeof parsed.name !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
}

function isGuest() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GUEST_KEY) === "1";
}

function setGuest() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_KEY, "1");
}

function clearGuest() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_KEY);
}

function setMockCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${MOCK_COOKIE}=1; path=/; max-age=2592000; samesite=lax`;
}

function clearMockCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${MOCK_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

async function ensureDemoAccount() {
  if (findAccount(DEMO_EMAIL)) return;
  const account: AuthAccount = {
    email: DEMO_EMAIL,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    name: DEMO_USER.name,
    createdAt: new Date().toISOString(),
  };
  addAccount(account);
}

function toAuthUser(user: User): AuthUser {
  const rawName = user.user_metadata?.name;
  const name = typeof rawName === "string" ? rawName.trim() : "";
  return { email: user.email ?? "", name: name || deriveName(user.email ?? "") };
}

function mapAuthError(error: AuthError): string {
  const msg = error.message.toLowerCase();
  if (msg.includes("invalid login credentials")) return "邮箱或密码错误";
  if (msg.includes("email not confirmed")) return "邮箱尚未验证，请先完成验证后再登录";
  if (msg.includes("already registered") || msg.includes("already been registered")) return "该邮箱已注册，请直接登录";
  if (msg.includes("token has expired") || msg.includes("invalid token") || msg.includes("token is invalid") || msg.includes("expired")) {
    return "验证码错误或已过期，请重新获取";
  }
  if (msg.includes("password should be") || msg.includes("weak password") || msg.includes("at least 6")) {
    return "密码强度不足，请使用至少 6 位的密码";
  }
  if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("over the limit")) {
    return "操作过于频繁，请稍后再试";
  }
  if (msg.includes("unable to validate") || msg.includes("invalid email")) return "请输入有效的邮箱地址";
  return error.message || "操作失败，请重试";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo<ReturnType<typeof getBrowserClient> | null>(() => {
    if (!SUPABASE_CONFIGURED || typeof window === "undefined") return null;
    try {
      return getBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const isMockMode = !SUPABASE_CONFIGURED;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>("login");

  useEffect(() => {
    if (!supabase) {
      // Mock mode: restore or auto demo-login on first visit.
      const stored = readUser();
      if (stored) {
        setUser(stored);
      } else if (!isGuest()) {
        writeUser(DEMO_USER);
        setMockCookie();
        setUser(DEMO_USER);
      }
      void ensureDemoAccount();
      setHydrated(true);
      return;
    }
    // Real mode: hydrate from existing session, then subscribe to changes.
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session?.user) setUser(toAuthUser(data.session.user));
        setHydrated(true);
      })
      .catch(() => {
        if (mounted) setHydrated(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ? toAuthUser(session.user) : null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const openAuthDialog = useCallback((nextIntent: AuthIntent = "login") => {
    setIntent(nextIntent);
    setDialogOpen(true);
  }, []);

  const closeAuthDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const trimmed = email.trim();
      if (!trimmed) return { ok: false, error: "请输入邮箱" };
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
        if (error) return { ok: false, error: mapAuthError(error) };
        if (data.user) setUser(toAuthUser(data.user));
        return { ok: true };
      }
      const account = findAccount(trimmed);
      if (!account) return { ok: false, error: "该邮箱尚未注册" };
      if ((await hashPassword(password)) !== account.passwordHash) {
        return { ok: false, error: "密码错误，请重试" };
      }
      const next: AuthUser = { email: account.email, name: account.name };
      writeUser(next);
      clearGuest();
      setMockCookie();
      setUser(next);
      return { ok: true };
    },
    [supabase],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string): Promise<AuthResult> => {
      const trimmed = email.trim();
      if (!trimmed) return { ok: false, error: "请输入邮箱" };
      if (password.length < 6) return { ok: false, error: "密码至少需要 6 个字符" };
      if (!supabase) {
        // Mock mode: no backend, create a local account and sign straight in.
        if (findAccount(trimmed)) return { ok: false, error: "该邮箱已注册，请直接登录" };
        const account: AuthAccount = {
          email: trimmed,
          passwordHash: await hashPassword(password),
          name: name?.trim() || deriveName(trimmed),
          createdAt: new Date().toISOString(),
        };
        addAccount(account);
        const local: AuthUser = { email: account.email, name: account.name };
        writeUser(local);
        clearGuest();
        setMockCookie();
        setUser(local);
        return { ok: true };
      }
      // Real mode: ask our backend to email a signup OTP. The password stays
      // client-side and is only submitted later inside verifySignupOtp().
      try {
        const res = await fetch("/api/auth/signup-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, name: name?.trim() || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || "验证码发送失败，请重试" };
        return { ok: true, awaitOtp: true };
      } catch {
        return { ok: false, error: "网络异常，请稍后重试" };
      }
    },
    [supabase],
  );

  const verifySignupOtp = useCallback(
    async (email: string, password: string, name: string, token: string): Promise<AuthResult> => {
      const trimmed = email.trim();
      const trimmedToken = token.trim();
      if (!trimmed) return { ok: false, error: "请输入邮箱" };
      if (!trimmedToken) return { ok: false, error: "请输入验证码" };
      if (!supabase) {
        // Mock mode: account already created in register(); sign in locally.
        const account = findAccount(trimmed);
        if (!account) return { ok: false, error: "请先完成注册" };
        const local: AuthUser = { email: account.email, name: account.name };
        writeUser(local);
        clearGuest();
        setMockCookie();
        setUser(local);
        return { ok: true };
      }
      try {
        // Verify code + create a confirmed user on the server.
        const res = await fetch("/api/auth/signup-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, password, name: name.trim() || undefined, code: trimmedToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || "验证失败，请重试" };
        // User created + email confirmed server-side; establish client session.
        const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
        if (error) return { ok: false, error: "注册成功，请前往登录" };
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) setUser(toAuthUser(userData.user));
        return { ok: true };
      } catch {
        return { ok: false, error: "网络异常，请稍后重试" };
      }
    },
    [supabase],
  );

  const resendSignupOtp = useCallback(
    async (email: string): Promise<AuthResult> => {
      const trimmed = email.trim();
      if (!trimmed) return { ok: false, error: "请输入邮箱" };
      if (!supabase) return { ok: true };
      try {
        const res = await fetch("/api/auth/signup-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error || "重新发送失败，请稍后重试" };
        return { ok: true };
      } catch {
        return { ok: false, error: "网络异常，请稍后重试" };
      }
    },
    [supabase],
  );

  const logout = useCallback(() => {
    if (supabase) void supabase.auth.signOut();
    clearUser();
    setGuest();
    clearMockCookie();
    setUser(null);
    setDialogOpen(false);
  }, [supabase]);

  const requireAuth = useCallback(
    (nextIntent: AuthIntent = "login") => {
      if (user) return true;
      setIntent(nextIntent);
      setDialogOpen(true);
      return false;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthed: Boolean(user),
      hydrated,
      dialogOpen,
      intent,
      isMockMode,
      openAuthDialog,
      closeAuthDialog,
      requireAuth,
      login,
      register,
      verifySignupOtp,
      resendSignupOtp,
      logout,
    }),
    [user, hydrated, dialogOpen, intent, isMockMode, openAuthDialog, closeAuthDialog, requireAuth, login, register, verifySignupOtp, resendSignupOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
