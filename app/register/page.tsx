"use client";

import { register } from "@/lib/supabase/actions";
import Link from "next/link";
import { useActionState } from "react";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(register, null);

  return (
    <div className="auth-shell">
      <form className="auth-card" action={formAction}>
        <div className="auth-header">
          <h1>Genora</h1>
          <p>创建账号，开始 AI 创作之旅</p>
        </div>

        <label className="auth-field">
          <span>邮箱</span>
          <input name="email" type="email" placeholder="your@email.com" required autoFocus />
        </label>

        <label className="auth-field">
          <span>密码</span>
          <input name="password" type="password" placeholder="至少 6 个字符" required minLength={6} />
        </label>

        <label className="auth-field">
          <span>确认密码</span>
          <input name="confirmPassword" type="password" placeholder="再次输入密码" required minLength={6} />
        </label>

        <button className="auth-submit" type="submit" disabled={isPending}>
          {isPending ? "注册中…" : "注 册"}
        </button>

        {state?.error && <div className="auth-error">{state.error}</div>}

        <div className="auth-footer">
          已有账号？<Link href="/login">立即登录</Link>
        </div>
      </form>
    </div>
  );
}
