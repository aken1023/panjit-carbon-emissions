"use client";

import { useActionState, useState } from "react";
import { createTarget } from "@/actions/reduction";
import { Button } from "@/components/ui/button";

export function CreateTargetForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTarget, null);

  // Close dialog on success
  if (state && "success" in state && state.success && open) {
    setOpen(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>新增目標</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg mx-4">
            <h2 className="text-lg font-semibold">新增減碳目標</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              設定企業的減碳目標與基準年數據
            </p>

            <form action={formAction} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="baseYear" className="text-sm font-medium">
                    基準年 <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="baseYear"
                    name="baseYear"
                    type="number"
                    required
                    min="2000"
                    max="2100"
                    placeholder="2023"
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="targetYear" className="text-sm font-medium">
                    目標年 <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="targetYear"
                    name="targetYear"
                    type="number"
                    required
                    min="2000"
                    max="2100"
                    placeholder="2030"
                    className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="targetType" className="text-sm font-medium">
                  減碳類型 <span className="text-destructive">*</span>
                </label>
                <select
                  id="targetType"
                  name="targetType"
                  required
                  defaultValue="ABSOLUTE"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="ABSOLUTE">絕對減量</option>
                  <option value="INTENSITY">強度減量</option>
                </select>
              </div>

              <div>
                <label htmlFor="reductionPct" className="text-sm font-medium">
                  減碳百分比（%）<span className="text-destructive">*</span>
                </label>
                <input
                  id="reductionPct"
                  name="reductionPct"
                  type="number"
                  required
                  min="0.1"
                  max="100"
                  step="0.1"
                  placeholder="42"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="baselineAmount"
                  className="text-sm font-medium"
                >
                  基準年排放量（tCO2e）
                  <span className="text-destructive">*</span>
                </label>
                <input
                  id="baselineAmount"
                  name="baselineAmount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="10000"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="description" className="text-sm font-medium">
                  說明
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  placeholder="選填：目標說明或備註"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {state && "error" in state && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "建立中..." : "建立目標"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
