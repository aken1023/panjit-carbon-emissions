"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const GRIDS = [
  { value: "tw", label: "台灣電力 (台電)", factor: 0.494, source: "經濟部能源署 2024" },
  { value: "cn_east", label: "中國華東電網", factor: 0.7035, source: "中國生態環境部 2022" },
  { value: "cn_south", label: "中國華南電網", factor: 0.4267, source: "中國生態環境部 2022" },
  { value: "cn_north", label: "中國華北電網", factor: 0.8843, source: "中國生態環境部 2022" },
  { value: "jp", label: "日本", factor: 0.457, source: "日本環境省 2023" },
  { value: "kr", label: "韓國", factor: 0.459, source: "韓國環境部 2023" },
];

const MONTHS = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

export function ElectricityCalc() {
  const [grid, setGrid] = useState("tw");
  const [inputMode, setInputMode] = useState("annual");
  const [annualUsage, setAnnualUsage] = useState("");
  const [monthlyUsage, setMonthlyUsage] = useState<string[]>(Array(12).fill(""));

  const selected = GRIDS.find((g) => g.value === grid)!;

  const totalKwh =
    inputMode === "annual"
      ? parseFloat(annualUsage) || 0
      : monthlyUsage.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const total = totalKwh * selected.factor / 1000;

  const monthlyBreakdown =
    inputMode === "monthly"
      ? monthlyUsage.map((v, i) => ({
          label: MONTHS[i],
          value: ((parseFloat(v) || 0) * selected.factor) / 1000,
          unit: "tCO2e" as const,
        }))
      : undefined;

  return (
    <CalcCard
      title="外購電力計算機"
      description="計算外購電力之間接溫室氣體排放"
      scope="Scope 2 — 能源間接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="電網/電力來源"
          id="elec-grid"
          value={grid}
          onChange={setGrid}
          options={GRIDS.map((g) => ({ value: g.value, label: g.label }))}
        />
        <CalcSelect
          label="輸入方式"
          id="elec-mode"
          value={inputMode}
          onChange={setInputMode}
          options={[
            { value: "annual", label: "年度總用電量" },
            { value: "monthly", label: "逐月輸入" },
          ]}
        />
      </div>

      {inputMode === "annual" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CalcInput
            label="年度用電量"
            id="elec-annual"
            value={annualUsage}
            onChange={setAnnualUsage}
            placeholder="輸入年度用電量"
            unit="kWh"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {MONTHS.map((month, i) => (
            <CalcInput
              key={month}
              label={month}
              id={`elec-month-${i}`}
              value={monthlyUsage[i]}
              onChange={(v) => {
                const next = [...monthlyUsage];
                next[i] = v;
                setMonthlyUsage(next);
              }}
              placeholder="kWh"
              unit="kWh"
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground sm:text-xs">
        <span>電力排放係數: <strong>{selected.factor}</strong> kgCO2e/kWh</span>
        <span>|</span>
        <span>來源: {selected.source}</span>
      </div>

      {inputMode === "monthly" && totalKwh > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          年度用電量合計：{totalKwh.toLocaleString("zh-TW")} kWh
        </div>
      )}

      <CalcResult
        label="排放量"
        value={total}
        unit="tCO2e"
        breakdown={monthlyBreakdown}
      />

      <CalcFormula
        formula={`${totalKwh.toLocaleString("zh-TW")} kWh × ${selected.factor} kgCO2e/kWh ÷ 1000 = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 用電量(kWh) × 電力排放係數(kgCO2e/kWh) ÷ 1000"
      />
    </CalcCard>
  );
}
