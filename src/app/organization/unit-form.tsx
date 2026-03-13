"use client";

import { useActionState, useState, useEffect } from "react";
import { createOrganizationUnit, deleteOrganizationUnit } from "@/actions/organization";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

const TYPE_OPTIONS = [
  { value: "SUBSIDIARY", label: "子公司" },
  { value: "PLANT", label: "廠區" },
  { value: "DEPARTMENT", label: "部門" },
];

type OrgUnit = {
  id: string;
  name: string;
};

export function CreateUnitForm({ existingUnits }: { existingUnits: OrgUnit[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createOrganizationUnit, null);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>新增組織單位</Button>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold">新增組織單位</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="unit-name" className="text-sm font-medium">
            名稱
          </label>
          <input
            id="unit-name"
            name="name"
            type="text"
            required
            className={`mt-1 ${inputClass}`}
            placeholder="例：新竹廠"
          />
        </div>
        <div>
          <label htmlFor="type" className="text-sm font-medium">
            類型
          </label>
          <select
            id="type"
            name="type"
            required
            className={`mt-1 ${inputClass}`}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="parentId" className="text-sm font-medium">
            上層單位（選填）
          </label>
          <select
            id="parentId"
            name="parentId"
            className={`mt-1 ${inputClass}`}
          >
            <option value="">無</option>
            {existingUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="equityShare" className="text-sm font-medium">
            持股比例 (%)
          </label>
          <input
            id="equityShare"
            name="equityShare"
            type="number"
            required
            defaultValue={100}
            min={0}
            max={100}
            step={0.01}
            className={`mt-1 ${inputClass}`}
          />
        </div>
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

export function DeleteUnitButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(deleteOrganizationUnit, null);

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
