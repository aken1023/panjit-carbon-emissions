"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const FUELS = [
  { value: "gasoline", label: "車用汽油", unit: "公升", factor: 2.2631, source: "環境部 2024" },
  { value: "diesel", label: "車用柴油", unit: "公升", factor: 2.7096, source: "環境部 2024" },
  { value: "jet_fuel", label: "航空燃油", unit: "公升", factor: 2.5457, source: "環境部 2024" },
];

export function MobileCombustionCalc() {
  const [fuel, setFuel] = useState("gasoline");
  const [mode, setMode] = useState("direct");
  const [amount, setAmount] = useState("");
  const [distance, setDistance] = useState("");
  const [efficiency, setEfficiency] = useState("");

  const selected = FUELS.find((f) => f.value === fuel)!;

  const fuelAmount =
    mode === "direct"
      ? parseFloat(amount) || 0
      : (parseFloat(distance) || 0) / (parseFloat(efficiency) || 1);

  const total = fuelAmount * selected.factor / 1000;

  return (
    <CalcCard
      title="移動燃燒源計算機"
      description="計算公司車輛、貨車、航空器等移動設備的燃料燃燒排放"
      scope="Scope 1 — 直接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="燃料類型"
          id="mob-fuel"
          value={fuel}
          onChange={setFuel}
          options={FUELS.map((f) => ({ value: f.value, label: f.label }))}
        />
        <CalcSelect
          label="輸入方式"
          id="mob-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "direct", label: "直接輸入用油量" },
            { value: "distance", label: "以行駛距離計算" },
          ]}
        />
      </div>

      {mode === "direct" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CalcInput
            label={`燃料使用量（${selected.unit}）`}
            id="mob-amount"
            value={amount}
            onChange={setAmount}
            placeholder="輸入用油量"
            unit={selected.unit}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CalcInput
            label="行駛距離"
            id="mob-distance"
            value={distance}
            onChange={setDistance}
            placeholder="輸入行駛距離"
            unit="km"
          />
          <CalcInput
            label="油耗效率"
            id="mob-efficiency"
            value={efficiency}
            onChange={setEfficiency}
            placeholder="每公升可行駛公里數"
            unit="km/L"
          />
        </div>
      )}

      {mode === "distance" && (parseFloat(distance) || 0) > 0 && (
        <div className="mt-2 text-xs text-muted-foreground">
          預估用油量：{fuelAmount.toFixed(2)} {selected.unit}
        </div>
      )}

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
          { label: "燃料使用量", value: fuelAmount, unit: selected.unit },
          { label: "排放係數", value: selected.factor, unit: `kgCO2e/${selected.unit}` },
        ]}
      />

      <CalcFormula
        formula={`${fuelAmount.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} ${selected.unit} × ${selected.factor} kgCO2e/${selected.unit} ÷ 1000 = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 活動數據 × 排放係數 ÷ 1000"
      />
    </CalcCard>
  );
}
