"use client";

import { useActionState, useRef } from "react";
import { login } from "@/actions/auth";

const DEMO_ACCOUNTS = [
  { label: "管理員", email: "admin@panjit.com", password: "admin123", role: "系統管理員" },
  { label: "碳管主管", email: "carbon@panjit.com", password: "carbon123", role: "碳管理主管" },
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleDemoLogin = (email: string, password: string) => {
    if (emailRef.current && passwordRef.current) {
      emailRef.current.value = email;
      passwordRef.current.value = password;
      formRef.current?.requestSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <form ref={formRef} action={formAction} className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              電子郵件
            </label>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              密碼
            </label>
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "登入中..." : "登入"}
          </button>
        </div>
      </form>

      {/* Quick demo login buttons */}
      <div className="rounded-xl border bg-muted/50 p-4">
        <p className="mb-3 text-center text-xs font-medium text-muted-foreground">
          測試帳號 — 點擊快速登入
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              disabled={pending}
              onClick={() => handleDemoLogin(account.email, account.password)}
              className="flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent disabled:opacity-50"
            >
              <span className="font-semibold">{account.label}</span>
              <span className="text-[10px] text-muted-foreground">{account.role}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{account.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
