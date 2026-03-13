"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const REFRIGERANTS = [
  { value: "R-134a", label: "R-134a (HFC)", gwp: 1430 },
  { value: "R-410A", label: "R-410A (HFC)", gwp: 2088 },
  { value: "R-32", label: "R-32 (HFC)", gwp: 675 },
  { value: "R-404A", label: "R-404A (HFC)", gwp: 3922 },
  { value: "R-407C", label: "R-407C (HFC)", gwp: 1774 },
  { value: "R-22", label: "R-22 / HCFC-22", gwp: 1810 },
  { value: "SF6", label: "SF\u2086 (六氟化硫)", gwp: 23500 },
  { value: "NF3", label: "NF\u2083 (三氟化氮)", gwp: 17200 },
  { value: "CO2_ext", label: "CO\u2082 滅火器", gwp: 1 },
];

export function FugitiveCalc() {
  const [refrigerant, setRefrigerant] = useState("R-134a");
  const [mode, setMode] = useState("simple");
  // Simple mode
  const [leakedAmount, setLeakedAmount] = useState("");
  // Detailed mode
  const [equipCount, setEquipCount] = useState("");
  const [originalCharge, setOriginalCharge] = useState("");
  const [leakRate, setLeakRate] = useState("");
  const [annualRefill, setAnnualRefill] = useState("");

  const selected = REFRIGERANTS.find((r) => r.value === refrigerant)!;

  let emissionKg = 0;
  let formulaText = "";

  if (mode === "simple") {
    const qty = parseFloat(leakedAmount) || 0;
    emissionKg = qty * selected.gwp;
    formulaText = `${qty} kg × ${selected.gwp.toLocaleString()} (GWP) ÷ 1000`;
  } else {
    const count = parseFloat(equipCount) || 0;
    const charge = parseFloat(originalCharge) || 0;
    const rate = (parseFloat(leakRate) || 0) / 100;
    const refill = parseFloat(annualRefill) || 0;
    emissionKg = count * (charge * rate + refill) * selected.gwp;
    formulaText = `${count} 台 × (${charge} kg × ${(rate * 100).toFixed(1)}% + ${refill} kg) × ${selected.gwp.toLocaleString()} (GWP) ÷ 1000`;
  }

  const total = emissionKg / 1000;

  return (
    <CalcCard
      title="逸散排放計算機"
      description="計算冷媒、含氟氣體等逸散性溫室氣體排放（設備漏洩、填充）"
      scope="Scope 1 — 直接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="冷媒/氣體類型"
          id="fug-refrigerant"
          value={refrigerant}
          onChange={setRefrigerant}
          options={REFRIGERANTS.map((r) => ({ value: r.value, label: r.label }))}
        />
        <CalcSelect
          label="計算模式"
          id="fug-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "simple", label: "簡易模式（直接輸入洩漏量）" },
            { value: "detailed", label: "詳細模式（設備數量/充填量/漏洩率）" },
          ]}
        />
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        GWP（全球暖化潛勢）: <strong>{selected.gwp.toLocaleString()}</strong>（IPCC AR5）
      </div>

      {mode === "simple" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CalcInput
            label="洩漏/排放量"
            id="fug-leaked"
            value={leakedAmount}
            onChange={setLeakedAmount}
            placeholder="輸入洩漏量"
            unit="kg"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CalcInput
            label="設備數量"
            id="fug-count"
            value={equipCount}
            onChange={setEquipCount}
            placeholder="設備台數"
            unit="台"
            step="1"
          />
          <CalcInput
            label="原始填充量"
            id="fug-charge"
            value={originalCharge}
            onChange={setOriginalCharge}
            placeholder="每台原始填充量"
            unit="kg"
          />
          <CalcInput
            label="年漏洩率"
            id="fug-leak-rate"
            value={leakRate}
            onChange={setLeakRate}
            placeholder="年漏洩百分比"
            unit="%"
          />
          <CalcInput
            label="年補充量"
            id="fug-refill"
            value={annualRefill}
            onChange={setAnnualRefill}
            placeholder="每台年補充量"
            unit="kg"
          />
        </div>
      )}

      <CalcResult
        label="排放量"
        value={total}
        unit="tCO2e"
        breakdown={[
          { label: "排放質量", value: emissionKg / selected.gwp, unit: "kg" },
          { label: "GWP", value: selected.gwp, unit: "" },
          { label: "CO2 當量", value: emissionKg, unit: "kgCO2e" },
        ]}
      />

      <CalcFormula
        formula={`${formulaText} = ${total.toFixed(4)} tCO2e`}
        note={
          mode === "simple"
            ? "排放量(tCO2e) = 洩漏量(kg) × GWP ÷ 1000"
            : "排放量 = 設備數量 × (原始填充量 × 年漏洩率 + 年補充量) × GWP ÷ 1000"
        }
      />
    </CalcCard>
  );
}
