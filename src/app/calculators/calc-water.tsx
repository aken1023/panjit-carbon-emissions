"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const FACTOR = 0.160; // kgCO2e/m³

export function WaterCalc() {
  const [inputMode, setInputMode] = useState("annual");
  const [annualUsage, setAnnualUsage] = useState("");
  const [monthlyUsage, setMonthlyUsage] = useState("");

  const qty =
    inputMode === "annual"
      ? parseFloat(annualUsage) || 0
      : (parseFloat(monthlyUsage) || 0) * 12;

  const monthlyQty = inputMode === "monthly" ? parseFloat(monthlyUsage) || 0 : qty / 12;
  const total = qty * FACTOR / 1000;

  return (
    <CalcCard
      title="自來水用水計算機"
      description="計算自來水供應及處理過程之溫室氣體排放"
      scope="Scope 3 — 其他間接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="輸入方式"
          id="water-mode"
          value={inputMode}
          onChange={setInputMode}
          options={[
            { value: "annual", label: "年度用水量" },
            { value: "monthly", label: "月平均用水量" },
          ]}
        />
        {inputMode === "annual" ? (
          <CalcInput
            label="年度用水量"
            id="water-annual"
            value={annualUsage}
            onChange={setAnnualUsage}
            placeholder="輸入年度用水量"
            unit="m³"
          />
        ) : (
          <CalcInput
            label="月平均用水量"
            id="water-monthly"
            value={monthlyUsage}
            onChange={setMonthlyUsage}
            placeholder="輸入月平均用水量"
            unit="m³/月"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground sm:text-xs">
        <span>排放係數: <strong>{FACTOR}</strong> kgCO2e/m³</span>
        <span>|</span>
        <span>來源: 環境部</span>
      </div>

      {inputMode === "monthly" && (parseFloat(monthlyUsage) || 0) > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          年度用水量推估：{qty.toLocaleString("zh-TW")} m³
        </div>
      )}

      <CalcResult
        label="排放量"
        value={total}
        unit="tCO2e"
        breakdown={[
          { label: "年度用水量", value: qty, unit: "m³" },
          { label: "月平均用水量", value: monthlyQty, unit: "m³/月" },
        ]}
      />

      <CalcFormula
        formula={`${qty.toLocaleString("zh-TW")} m³ × ${FACTOR} kgCO2e/m³ ÷ 1000 = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 用水量(m³) × 排放係數(kgCO2e/m³) ÷ 1000"
      />
    </CalcCard>
  );
}
