"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { createUser, type SettingsState } from "@/actions/settings";

const ROLE_OPTIONS = [
  { value: "DATA_ENTRY", label: "資料填報人" },
  { value: "CARBON_MANAGER", label: "碳管理主管" },
  { value: "AUDITOR", label: "查核人員" },
  { value: "VIEWER", label: "唯讀" },
  { value: "ADMIN", label: "系統管理員" },
];

export function UserManagementSection() {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState<SettingsState, FormData>(createUser, null);

  return (
    <div>
      {!showForm ? (
        <Button onClick={() => setShowForm(true)}>新增使用者</Button>
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">新增使用者</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              取消
            </Button>
          </div>

          {state?.error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
              {state.success}
            </div>
          )}

          <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                姓名
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="使用者姓名"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                密碼
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="設定密碼"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="role" className="text-sm font-medium">
                角色
              </label>
              <select
                id="role"
                name="role"
                required
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? "新增中..." : "新增使用者"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
