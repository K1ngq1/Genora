"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuthState = { error: string } | null;

export async function login(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });

    if (error) {
      console.error("[login] Supabase signIn error:", JSON.stringify({ code: error.code, message: error.message, status: error.status, name: error.name }));
      return { error: error.message };
    }
    console.log("[login] signIn success:", data.user?.email);
  } catch (e) {
    console.error("[login] Supabase fetch error:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return { error: "无法连接到认证服务，请检查网络后重试" };
  }

  redirect("/");
}

export async function register(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return { error: "两次输入的密码不一致" };
  }

  if (password.length < 6) {
    return { error: "密码至少需要 6 个字符" };
  }

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      console.error("[register] Supabase signUp error:", JSON.stringify({ code: error.code, message: error.message, status: error.status, name: error.name }));
      return { error: error.message };
    }
    console.log("[register] signUp success:", data.user?.email);
  } catch (e) {
    console.error("[register] Supabase fetch error:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    return { error: "无法连接到认证服务，请检查网络后重试" };
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
