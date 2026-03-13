"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const UNITS = [
  { value: "gj", label: "GJ（吉焦）", factor: 0.067, unit: "tCO2e/GJ" },
  { value: "tonne", label: "公噸蒸汽 (t-steam)", factor: 2.545, unit: "tCO2e/t-steam" },
];

export function SteamCalc() {
  const [steamUnit, setSteamUnit] = useState("gj");
  const [usage, setUsage] = useState("");

  const selected = UNITS.find((u) => u.value === steamUnit)!;
  const qty = parseFloat(usage) || 0;
  const total = qty * selected.factor;

  return (
    <CalcCard
      title="外購蒸汽/熱能計算機"
      description="計算外購蒸汽或熱能之間接溫室氣體排放"
      scope="Scope 2 — 能源間接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="蒸汽計量單位"
          id="steam-unit"
          value={steamUnit}
          onChange={setSteamUnit}
          options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
        />
        <CalcInput
          label="蒸汽使用量"
          id="steam-usage"
          value={usage}
          onChange={setUsage}
          placeholder="輸入使用量"
          unit={steamUnit === "gj" ? "GJ" : "t-steam"}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground sm:text-xs">
        <span>排放係數: <strong>{selected.factor}</strong> {selected.unit}</span>
        <span>|</span>
        <span>來源: 環境部溫室氣體排放係數管理表 6.0.4 版</span>
      </div>

      {steamUnit === "tonne" && (
        <div className="mt-2 text-[10px] text-muted-foreground sm:text-xs">
          備註：蒸汽排放係數以焓值為基準計算，假設蒸汽壓力為 10 kg/cm² (飽和蒸汽)
        </div>
      )}

      <CalcResult
        label="排放量"
        value={total}
        unit="tCO2e"
        breakdown={[
          { label: "蒸汽使用量", value: qty, unit: steamUnit === "gj" ? "GJ" : "t-steam" },
          { label: "排放係數", value: selected.factor, unit: selected.unit },
        ]}
      />

      <CalcFormula
        formula={`${qty.toLocaleString("zh-TW")} ${steamUnit === "gj" ? "GJ" : "t-steam"} × ${selected.factor} ${selected.unit} = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 蒸汽使用量 × 排放係數"
      />
    </CalcCard>
  );
}
