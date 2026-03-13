"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const COMMUTE_MODES = [
  { value: "car", label: "自小客車", factor: 0.178, unit: "kgCO2e/人·km" },
  { value: "motorcycle", label: "機車", factor: 0.060, unit: "kgCO2e/人·km" },
  { value: "bus", label: "公車", factor: 0.0423, unit: "kgCO2e/人·km" },
  { value: "mrt", label: "捷運/地鐵", factor: 0.0235, unit: "kgCO2e/人·km" },
  { value: "hsr", label: "高鐵", factor: 0.0354, unit: "kgCO2e/人·km" },
  { value: "walk_bike", label: "腳踏車/步行", factor: 0, unit: "kgCO2e/人·km" },
  { value: "e_motorcycle", label: "電動機車", factor: 0.020, unit: "kgCO2e/人·km" },
];

export function CommuteCalc() {
  const [mode, setMode] = useState("car");
  const [distance, setDistance] = useState("");
  const [employees, setEmployees] = useState("");
  const [workingDays, setWorkingDays] = useState("240");

  const selected = COMMUTE_MODES.find((m) => m.value === mode)!;
  const dist = parseFloat(distance) || 0;
  const pax = parseFloat(employees) || 0;
  const days = parseFloat(workingDays) || 0;

  // Round trip = distance × 2
  const totalPersonKm = dist * 2 * pax * days;
  const total = totalPersonKm * selected.factor / 1000;

  return (
    <CalcCard
      title="員工通勤計算機"
      description="計算員工日常通勤之溫室氣體排放"
      scope="Scope 3 — 其他間接排放"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcSelect
          label="通勤方式"
          id="commute-mode"
          value={mode}
          onChange={setMode}
          options={COMMUTE_MODES.map((m) => ({ value: m.value, label: m.label }))}
        />
        <CalcInput
          label="單程距離"
          id="commute-distance"
          value={distance}
          onChange={setDistance}
          placeholder="住家到公司單程距離"
          unit="km"
        />
        <CalcInput
          label="員工人數"
          id="commute-employees"
          value={employees}
          onChange={setEmployees}
          placeholder="使用此交通方式人數"
          unit="人"
          step="1"
        />
        <CalcInput
          label="年工作天數"
          id="commute-days"
          value={workingDays}
          onChange={setWorkingDays}
          placeholder="預設 240 天"
          unit="天/年"
          step="1"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground sm:text-xs">
        <span>排放係數: <strong>{selected.factor}</strong> {selected.unit}</span>
        <span>|</span>
        <span>年度人·公里: {totalPersonKm.toLocaleString("zh-TW")} 人·km（含來回）</span>
      </div>

      <CalcResult
        label="年度通勤排放量"
        value={total}
        unit="tCO2e"
        breakdown={[
          { label: "單程距離", value: dist, unit: "km" },
          { label: "每日來回距離", value: dist * 2, unit: "km" },
          { label: "員工人數", value: pax, unit: "人" },
          { label: "年度人·公里", value: totalPersonKm, unit: "人·km" },
        ]}
      />

      <CalcFormula
        formula={`${dist} km × 2(來回) × ${pax} 人 × ${days} 天 × ${selected.factor} ${selected.unit} ÷ 1000 = ${total.toFixed(4)} tCO2e`}
        note="排放量(tCO2e) = 單程距離 × 2 × 員工人數 × 年工作天數 × 排放係數 ÷ 1000"
      />
    </CalcCard>
  );
}
