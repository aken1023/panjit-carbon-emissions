"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const INDUSTRIES = [
  { value: "334413", label: "半導體", naics: "334413", factor: 0.32, unit: "kgCO2e/USD" },
  { value: "334412", label: "PCB (印刷電路板)", naics: "334412", factor: 0.28, unit: "kgCO2e/USD" },
  { value: "334416", label: "被動元件", naics: "334416", factor: 0.30, unit: "kgCO2e/USD" },
  { value: "331110", label: "鋼鐵", naics: "331110", factor: 0.95, unit: "kgCO2e/USD" },
  { value: "325199", label: "化學品", naics: "325199", factor: 0.68, unit: "kgCO2e/USD" },
  { value: "326110", label: "塑膠原料", naics: "326110", factor: 0.55, unit: "kgCO2e/USD" },
  { value: "322210", label: "包裝材料", naics: "322210", factor: 0.42, unit: "kgCO2e/USD" },
  { value: "334419", label: "其他電子零組件", naics: "334419", factor: 0.35, unit: "kgCO2e/USD" },
];

const TWD_TO_USD = 31.5;

export function PurchasedGoodsCalc() {
  const [industry, setIndustry] = useState("334413");
  const [currency, setCurrency] = useState("usd");
  const [amount, setAmount] = useState("");

  const selected = INDUSTRIES.find((i) => i.value === industry)!;
  const rawAmount = parseFloat(amount) || 0;
  const amountUsd = currency === "twd" ? rawAmount / TWD_TO_USD : rawAmount;
  const total = amountUsd * selected.factor / 1000;

  return (
    <CalcCard
      title="外購商品計算機"
      description="以 USEEIO 支出法估算外購商品及服務之溫室氣體排放（Spend-based method）"
      scope="Scope 3 — 其他間接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="產業/商品類別"
          id="purchased-industry"
          value={industry}
          onChange={setIndustry}
          options={INDUSTRIES.map((i) => ({ value: i.value, label: i.label }))}
        />
        <CalcSelect
          label="幣別"
          id="purchased-currency"
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "usd", label: "美元 (USD)" },
            { value: "twd", label: "新台幣 (TWD)" },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CalcInput
          label="採購金額"
          id="purchased-amount"
          value={amount}
          onChange={setAmount}
          placeholder="輸入採購金額"
          unit={currency === "usd" ? "USD" : "TWD"}
        />
      </div>

      <div className="mt-3 space-y-1 text-[10px] text-muted-foreground sm:text-xs">
        <div className="flex flex-wrap gap-2">
          <span>NAICS 代碼: <strong>{selected.naics}</strong></span>
          <span>|</span>
          <span>排放係數: <strong>{selected.factor}</strong> {selected.unit}</span>
        </div>
        {currency === "twd" && (
          <div>匯率: 1 USD = {TWD_TO_USD} TWD | 折合 USD: {amountUsd.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}</div>
        )}
        <div>來源: US EPA USEEIO v2.0 模型</div>
      </div>

      <CalcResult
        label="排放量"
        value={total}
        unit="tCO2e"
        breakdown={[
          { label: "採購金額 (USD)", value: amountUsd, unit: "USD" },
          { label: "排放係數", value: selected.factor, unit: selected.unit },
        ]}
      />

      <CalcFormula
        formula={`${amountUsd.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} USD × ${selected.factor} kgCO2e/USD ÷ 1000 = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 採購金額(USD) × EEIO排放係數(kgCO2e/USD) ÷ 1000。此為支出法估算，精度有限，建議搭配供應商實際數據校正。"
      />
    </CalcCard>
  );
}
