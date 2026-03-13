"use client";

import { useActionState, useState, useEffect } from "react";
import { createEmissionSource, deleteEmissionSource } from "@/actions/sources";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

const SCOPE1_CATEGORIES = [
  { value: "STATIONARY_COMBUSTION", label: "固定燃燒源" },
  { value: "MOBILE_COMBUSTION", label: "移動燃燒源" },
  { value: "PROCESS", label: "製程排放" },
  { value: "FUGITIVE", label: "逸散排放" },
];

const SCOPE2_CATEGORIES = [
  { value: "PURCHASED_ELECTRICITY", label: "外購電力" },
  { value: "PURCHASED_STEAM", label: "外購蒸汽/熱能" },
];

type OrgUnit = {
  id: string;
  name: string;
};

export function CreateSourceForm({ units }: { units: OrgUnit[] }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("1");
  const [state, formAction, pending] = useActionState(createEmissionSource, null);

  const categories = scope === "1" ? SCOPE1_CATEGORIES : SCOPE2_CATEGORIES;

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>新增排放源</Button>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold">新增排放源</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="source-name" className="text-sm font-medium">
            排放源名稱
          </label>
          <input
            id="source-name"
            name="name"
            type="text"
            required
            className={`mt-1 ${inputClass}`}
            placeholder="例：廠區鍋爐-天然氣"
          />
        </div>
        <div>
          <label htmlFor="scope" className="text-sm font-medium">
            範疇
          </label>
          <select
            id="scope"
            name="scope"
            required
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={`mt-1 ${inputClass}`}
          >
            <option value="1">範疇一（直接排放）</option>
            <option value="2">範疇二（間接排放）</option>
          </select>
        </div>
        <div>
          <label htmlFor="category" className="text-sm font-medium">
            排放類別
          </label>
          <select
            id="category"
            name="category"
            required
            className={`mt-1 ${inputClass}`}
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="unitId" className="text-sm font-medium">
            廠區/部門
          </label>
          <select
            id="unitId"
            name="unitId"
            required
            className={`mt-1 ${inputClass}`}
          >
            <option value="">請選擇</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="description" className="text-sm font-medium">
          說明（選填）
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          className={`mt-1 ${inputClass}`}
        />
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

export function DeleteSourceButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(deleteEmissionSource, null);

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
