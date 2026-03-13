"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { createEmissionFactor, type SettingsState } from "@/actions/settings";

const SCOPE_OPTIONS = [
  { value: "1", label: "範疇一（直接排放）" },
  { value: "2", label: "範疇二（間接排放）" },
  { value: "3", label: "範疇三（價值鏈排放）" },
];

const CATEGORY_OPTIONS = [
  { value: "STATIONARY_COMBUSTION", label: "固定燃燒源" },
  { value: "MOBILE_COMBUSTION", label: "移動燃燒源" },
  { value: "PROCESS", label: "製程排放" },
  { value: "FUGITIVE", label: "逸散排放" },
  { value: "PURCHASED_ELECTRICITY", label: "外購電力" },
  { value: "PURCHASED_STEAM", label: "外購蒸汽/熱能" },
];

const inputClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50";

export function EmissionFactorSection() {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, isPending] = useActionState<SettingsState, FormData>(
    createEmissionFactor,
    null
  );

  return (
    <div>
      {!showForm ? (
        <Button onClick={() => setShowForm(true)}>新增排放係數</Button>
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">新增自訂排放係數</h3>
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

          <form action={formAction} className="space-y-4">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label htmlFor="ef-name" className="text-sm font-medium">
                  名稱
                </label>
                <input
                  id="ef-name"
                  name="name"
                  type="text"
                  required
                  placeholder="排放係數名稱"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ef-scope" className="text-sm font-medium">
                  範疇
                </label>
                <select id="ef-scope" name="scope" required className={inputClass}>
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ef-category" className="text-sm font-medium">
                  類別
                </label>
                <select id="ef-category" name="category" required className={inputClass}>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ef-unit" className="text-sm font-medium">
                  單位
                </label>
                <input
                  id="ef-unit"
                  name="unit"
                  type="text"
                  required
                  placeholder="例如: kgCO2e/kWh"
                  className={inputClass}
                />
              </div>
            </div>

            {/* GHG Factors */}
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                溫室氣體排放係數（kg/單位）
              </p>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
                {[
                  { name: "co2Factor", label: "CO\u2082" },
                  { name: "ch4Factor", label: "CH\u2084" },
                  { name: "n2oFactor", label: "N\u2082O" },
                  { name: "hfcFactor", label: "HFCs" },
                  { name: "pfcFactor", label: "PFCs" },
                  { name: "sf6Factor", label: "SF\u2086" },
                  { name: "nf3Factor", label: "NF\u2083" },
                ].map((gas) => (
                  <div key={gas.name} className="space-y-1.5">
                    <label htmlFor={`ef-${gas.name}`} className="text-sm font-medium">
                      {gas.label}
                    </label>
                    <input
                      id={`ef-${gas.name}`}
                      name={gas.name}
                      type="number"
                      step="any"
                      defaultValue="0"
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Year */}
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <label htmlFor="ef-year" className="text-sm font-medium">
                  生效年度
                </label>
                <input
                  id="ef-year"
                  name="effectiveYear"
                  type="number"
                  required
                  defaultValue={new Date().getFullYear()}
                  className={inputClass}
                />
              </div>
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending ? "新增中..." : "新增排放係數"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
