"use client";

import { login } from "@/lib/supabase/actions";
import Link from "next/link";
import { useActionState } from "react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <div className="auth-shell">
      <form className="auth-card" action={formAction}>
        <div className="auth-header">
          <h1>Genora</h1>
          <p>登录你的账号继续创作</p>
        </div>

        <label className="auth-field">
          <span>邮箱</span>
          <input name="email" type="email" placeholder="your@email.com" required autoFocus />
        </label>

        <label className="auth-field">
          <span>密码</span>
          <input name="password" type="password" placeholder="输入密码" required />
        </label>

        <button className="auth-submit" type="submit" disabled={isPending}>
          {isPending ? "登录中…" : "登 录"}
        </button>

        {state?.error && <div className="auth-error">{state.error}</div>}

        <div className="auth-footer">
          还没有账号？<Link href="/register">立即注册</Link>
        </div>
      </form>
    </div>
  );
}
