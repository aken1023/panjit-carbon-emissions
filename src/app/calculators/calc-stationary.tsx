"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const FUELS = [
  { value: "natural_gas", label: "天然氣", unit: "m³", factor: 2.0902, co2: 2.09, ch4: 0.0001, n2o: 0.0001, source: "環境部 2024" },
  { value: "diesel", label: "柴油", unit: "公升", factor: 2.6102, co2: 2.61, ch4: 0.0001, n2o: 0.0001, source: "環境部 2024" },
  { value: "fuel_oil", label: "重油", unit: "公升", factor: 2.8193, co2: 2.8174, ch4: 0.0009, n2o: 0.001, source: "環境部 2024" },
  { value: "lpg", label: "液化石油氣 (LPG)", unit: "公斤", factor: 3.0002, co2: 3.00, ch4: 0.0001, n2o: 0.0001, source: "環境部 2024" },
  { value: "coal", label: "煤炭", unit: "公斤", factor: 2.7295, co2: 2.7237, ch4: 0.0018, n2o: 0.004, source: "IPCC 2006" },
  { value: "kerosene", label: "煤油", unit: "公升", factor: 2.5310, co2: 2.529, ch4: 0.001, n2o: 0.001, source: "環境部 2024" },
  { value: "acetylene", label: "乙炔", unit: "公斤", factor: 3.3846, co2: 3.3846, ch4: 0, n2o: 0, source: "IPCC 2006" },
];

export function StationaryCombustionCalc() {
  const [fuel, setFuel] = useState("natural_gas");
  const [amount, setAmount] = useState("");

  const selected = FUELS.find((f) => f.value === fuel)!;
  const qty = parseFloat(amount) || 0;
  const co2 = qty * selected.co2 / 1000;
  const ch4 = qty * selected.ch4 / 1000;
  const n2o = qty * selected.n2o / 1000;
  const total = qty * selected.factor / 1000;

  return (
    <CalcCard
      title="固定燃燒源計算機"
      description="計算鍋爐、發電機、加熱爐等固定設備的燃料燃燒排放"
      scope="Scope 1 — 直接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="燃料類型"
          id="stat-fuel"
          value={fuel}
          onChange={setFuel}
          options={FUELS.map((f) => ({ value: f.value, label: f.label }))}
        />
        <CalcInput
          label={`使用量（${selected.unit}）`}
          id="stat-amount"
          value={amount}
          onChange={setAmount}
          placeholder="輸入使用量"
          unit={selected.unit}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground sm:text-xs">
        <span>排放係數: <strong>{selected.factor}</strong> kgCO2e/{selected.unit}</span>
        <span>|</span>
        <span>來源: {selected.source}</span>
      </div>

      <CalcResult
        label="排放量"
        value={total}
        unit="tCO2e"
        breakdown={[
          { label: "CO₂", value: co2, unit: "tCO2" },
          { label: "CH₄", value: ch4, unit: "tCO2e" },
          { label: "N₂O", value: n2o, unit: "tCO2e" },
        ]}
      />

      <CalcFormula
        formula={`${qty.toLocaleString()} ${selected.unit} × ${selected.factor} kgCO2e/${selected.unit} ÷ 1000 = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 活動數據 × 排放係數 ÷ 1000"
      />
    </CalcCard>
  );
}
