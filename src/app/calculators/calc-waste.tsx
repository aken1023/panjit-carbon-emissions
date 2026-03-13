"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const WASTE_TYPES = [
  { value: "general_incineration", label: "一般事業廢棄物 — 焚化", factor: 0.5, source: "環境部" },
  { value: "general_landfill", label: "一般事業廢棄物 — 掩埋", factor: 1.108, source: "環境部" },
  { value: "hazardous_incineration", label: "有害事業廢棄物 — 焚化", factor: 0.8, source: "環境部" },
  { value: "recycling", label: "資源回收", factor: 0.021, source: "環境部" },
  { value: "composting", label: "廚餘堆肥", factor: 0.132, source: "環境部" },
];

export function WasteCalc() {
  const [wasteType, setWasteType] = useState("general_incineration");
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState("kg");

  const selected = WASTE_TYPES.find((w) => w.value === wasteType)!;
  const rawQty = parseFloat(amount) || 0;
  const qtyKg = amountUnit === "tonne" ? rawQty * 1000 : rawQty;
  const total = qtyKg * selected.factor / 1000;

  return (
    <CalcCard
      title="廢棄物處理計算機"
      description="計算事業廢棄物處理（焚化、掩埋、回收）之溫室氣體排放"
      scope="Scope 3 — 其他間接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="廢棄物類型"
          id="waste-type"
          value={wasteType}
          onChange={setWasteType}
          options={WASTE_TYPES.map((w) => ({ value: w.value, label: w.label }))}
        />
        <CalcSelect
          label="重量單位"
          id="waste-unit"
          value={amountUnit}
          onChange={setAmountUnit}
          options={[
            { value: "kg", label: "公斤 (kg)" },
            { value: "tonne", label: "公噸 (t)" },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CalcInput
          label="廢棄物數量"
          id="waste-amount"
          value={amount}
          onChange={setAmount}
          placeholder="輸入廢棄物數量"
          unit={amountUnit === "tonne" ? "公噸" : "kg"}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground sm:text-xs">
        <span>排放係數: <strong>{selected.factor}</strong> kgCO2e/kg</span>
        <span>|</span>
        <span>來源: {selected.source}</span>
      </div>

      <CalcResult
        label="排放量"
        value={total}
        unit="tCO2e"
        breakdown={[
          { label: "廢棄物重量", value: qtyKg, unit: "kg" },
          { label: "排放係數", value: selected.factor, unit: "kgCO2e/kg" },
        ]}
      />

      <CalcFormula
        formula={`${qtyKg.toLocaleString("zh-TW")} kg × ${selected.factor} kgCO2e/kg ÷ 1000 = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 廢棄物重量(kg) × 排放係數(kgCO2e/kg) ÷ 1000"
      />
    </CalcCard>
  );
}
