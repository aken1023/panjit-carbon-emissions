"use client";

import { useActionState, useState, useEffect } from "react";
import { createInventoryPeriod, deleteInventoryPeriod } from "@/actions/inventory";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function CreateInventoryForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInventoryPeriod, null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>新增盤查期間</Button>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold">新增盤查期間</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="year" className="text-sm font-medium">
            年度
          </label>
          <input
            id="year"
            name="year"
            type="number"
            required
            defaultValue={currentYear}
            min={2000}
            max={2100}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            名稱
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={`${currentYear} 年度盤查`}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="isBaseYear"
          name="isBaseYear"
          type="checkbox"
          className="size-4 rounded border"
        />
        <label htmlFor="isBaseYear" className="text-sm font-medium">
          是否為基準年
        </label>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "建立中..." : "送出"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          取消
        </Button>
      </div>
    </form>
  );
}

export function DeleteInventoryButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(deleteInventoryPeriod, null);

  if (disabled) return null;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      {state?.error && (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      )}
      <Button
        type="submit"
        variant="ghost"
        size="xs"
        disabled={pending}
        className="text-destructive hover:text-destructive"
      >
        {pending ? "刪除中..." : "刪除"}
      </Button>
    </form>
  );
}
