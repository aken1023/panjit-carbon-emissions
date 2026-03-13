"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect } from "./calc-shared";

const CATEGORIES: Record<string, { label: string; units: { value: string; label: string; toBase: number }[] }> = {
  energy: {
    label: "能源",
    units: [
      { value: "gj", label: "GJ（吉焦）", toBase: 1 },
      { value: "mwh", label: "MWh（兆瓦時）", toBase: 3.6 },
      { value: "kwh", label: "kWh（千瓦時）", toBase: 0.0036 },
      { value: "kcal", label: "kcal（千卡）", toBase: 0.000004184 },
      { value: "mj", label: "MJ（兆焦）", toBase: 0.001 },
      { value: "btu", label: "BTU（英熱單位）", toBase: 0.000001055 },
      { value: "toe", label: "toe（公噸油當量）", toBase: 41.868 },
    ],
  },
  volume: {
    label: "體積",
    units: [
      { value: "l", label: "公升 (L)", toBase: 1 },
      { value: "m3", label: "立方公尺 (m³)", toBase: 1000 },
      { value: "gal", label: "加侖 (US gallon)", toBase: 3.78541 },
      { value: "barrel", label: "桶 (barrel)", toBase: 158.987 },
    ],
  },
  mass: {
    label: "質量",
    units: [
      { value: "kg", label: "公斤 (kg)", toBase: 1 },
      { value: "tonne", label: "公噸 (t)", toBase: 1000 },
      { value: "lb", label: "磅 (lb)", toBase: 0.453592 },
      { value: "short_ton", label: "短噸 (short ton)", toBase: 907.185 },
    ],
  },
  emissions: {
    label: "排放量",
    units: [
      { value: "tco2e", label: "tCO2e", toBase: 1 },
      { value: "kgco2e", label: "kgCO2e", toBase: 0.001 },
      { value: "gco2e", label: "gCO2e", toBase: 0.000001 },
      { value: "mtco2e", label: "MtCO2e（百萬噸）", toBase: 1000000 },
    ],
  },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, { label }]) => ({ value, label }));

export function UnitConverterCalc() {
  const [category, setCategory] = useState("energy");
  const [fromUnit, setFromUnit] = useState("kwh");
  const [toUnit, setToUnit] = useState("gj");
  const [inputValue, setInputValue] = useState("");

  const cat = CATEGORIES[category];
  const from = cat.units.find((u) => u.value === fromUnit);
  const to = cat.units.find((u) => u.value === toUnit);

  // Reset units when category changes
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const newUnits = CATEGORIES[newCat].units;
    setFromUnit(newUnits[0]?.value ?? "");
    setToUnit(newUnits[1]?.value ?? newUnits[0]?.value ?? "");
    setInputValue("");
  };

  const val = parseFloat(inputValue) || 0;
  const result = from && to ? (val * from.toBase) / to.toBase : 0;

  return (
    <CalcCard
      title="單位換算工具"
      description="能源、體積、質量、排放量等常用單位換算"
      scope="工具"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="換算類別"
          id="conv-category"
          value={category}
          onChange={handleCategoryChange}
          options={CATEGORY_OPTIONS}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <CalcSelect
            label="從"
            id="conv-from"
            value={fromUnit}
            onChange={setFromUnit}
            options={cat.units.map((u) => ({ value: u.value, label: u.label }))}
          />
          <div className="mt-2">
            <CalcInput
              label="輸入數值"
              id="conv-input"
              value={inputValue}
              onChange={setInputValue}
              placeholder="輸入數值"
            />
          </div>
        </div>
        <div>
          <CalcSelect
            label="到"
            id="conv-to"
            value={toUnit}
            onChange={setToUnit}
            options={cat.units.map((u) => ({ value: u.value, label: u.label }))}
          />
          <div className="mt-2">
            <div>
              <label className="text-xs font-medium sm:text-sm">結果</label>
              <div className="mt-1 flex min-h-[42px] items-center rounded-lg border bg-muted/30 px-3 py-2">
                <span className="text-sm font-semibold tabular-nums">
                  {result.toLocaleString("zh-TW", { maximumFractionDigits: 8 })}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{to?.label ?? ""}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion table */}
      {val > 0 && (
        <div className="mt-5 rounded-lg border p-3 sm:p-4">
          <p className="mb-2 text-xs font-medium sm:text-sm">
            {val.toLocaleString("zh-TW")} {from?.label} 換算表
          </p>
          <div className="space-y-1">
            {cat.units.map((u) => {
              if (!from) return null;
              const converted = (val * from.toBase) / u.toBase;
              return (
                <div
                  key={u.value}
                  className={`flex justify-between rounded px-2 py-1 text-xs ${u.value === toUnit ? "bg-primary/10 font-medium" : "text-muted-foreground"}`}
                >
                  <span>{u.label}</span>
                  <span className="tabular-nums">
                    {converted.toLocaleString("zh-TW", { maximumFractionDigits: 8 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CalcCard>
  );
}
