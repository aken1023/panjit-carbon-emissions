"use client";

import { ReactNode } from "react";

export function CalcCard({
  title,
  description,
  scope,
  children,
}: {
  title: string;
  description: string;
  scope: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
            {scope}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{description}</p>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

export function CalcInput({
  label,
  id,
  value,
  onChange,
  placeholder,
  unit,
  type = "number",
  min,
  step,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium sm:text-sm">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={type}
          min={min ?? "0"}
          step={step ?? "0.01"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function CalcSelect({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium sm:text-sm">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CalcResult({
  label,
  value,
  unit,
  breakdown,
}: {
  label: string;
  value: number;
  unit: string;
  breakdown?: { label: string; value: number; unit: string }[];
}) {
  return (
    <div className="mt-5 rounded-lg bg-muted/50 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
        <span className="text-xl font-bold tabular-nums sm:text-2xl">
          {value.toLocaleString("zh-TW", { maximumFractionDigits: 4 })} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </span>
      </div>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-3 space-y-1 border-t pt-3">
          {breakdown.map((item) => (
            <div key={item.label} className="flex justify-between text-xs text-muted-foreground">
              <span>{item.label}</span>
              <span className="tabular-nums">
                {item.value.toLocaleString("zh-TW", { maximumFractionDigits: 4 })} {item.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CalcFormula({ formula, note }: { formula: string; note?: string }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3 sm:p-4">
      <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">計算公式</p>
      <p className="mt-1 font-mono text-xs sm:text-sm">{formula}</p>
      {note && <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">{note}</p>}
    </div>
  );
}
