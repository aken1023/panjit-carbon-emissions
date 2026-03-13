"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcResult, CalcFormula } from "./calc-shared";

const EU_ETS_EUR_PER_TCO2 = 90;
const EUR_TO_TWD = 34.5;
const SBTI_REDUCTION_COST_USD = 50;
const USD_TO_TWD = 31.5;

const SCENARIOS = [
  { label: "低碳費情境", rate: 100 },
  { label: "基準碳費情境", rate: 300 },
  { label: "高碳費情境", rate: 500 },
  { label: "極高碳費情境", rate: 1000 },
];

export function CarbonFeeCalc() {
  const [emissions, setEmissions] = useState("");
  const [feeRate, setFeeRate] = useState("300");
  const [freeAllowance, setFreeAllowance] = useState("0");

  const emissionQty = parseFloat(emissions) || 0;
  const rate = parseFloat(feeRate) || 0;
  const allowancePct = parseFloat(freeAllowance) || 0;

  const chargeableEmissions = emissionQty * (1 - allowancePct / 100);
  const grossFee = emissionQty * rate;
  const netFee = chargeableEmissions * rate;
  const savings = grossFee - netFee;

  const euEtsCostTwd = emissionQty * EU_ETS_EUR_PER_TCO2 * EUR_TO_TWD;
  const sbtiCostTwd = emissionQty * SBTI_REDUCTION_COST_USD * USD_TO_TWD;

  return (
    <CalcCard
      title="碳費計算機"
      description="依台灣碳費徵收辦法試算碳費，並比較國際碳定價"
      scope="碳費試算"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CalcInput
          label="年度排放量"
          id="cf-emissions"
          value={emissions}
          onChange={setEmissions}
          placeholder="輸入年度排放量"
          unit="tCO2e"
        />
        <CalcInput
          label="碳費費率"
          id="cf-rate"
          value={feeRate}
          onChange={setFeeRate}
          placeholder="預設 300"
          unit="NT$/tCO2e"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CalcInput
          label="免費額度比例"
          id="cf-allowance"
          value={freeAllowance}
          onChange={setFreeAllowance}
          placeholder="0-100"
          unit="%"
        />
      </div>

      <div className="mt-3 text-[10px] text-muted-foreground sm:text-xs">
        應徵排放量：{chargeableEmissions.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} tCO2e
        {allowancePct > 0 && ` （免費額度節省 ${savings.toLocaleString("zh-TW")} 元）`}
      </div>

      <CalcResult
        label="應繳碳費"
        value={netFee}
        unit="NT$"
        breakdown={[
          { label: "年度排放量", value: emissionQty, unit: "tCO2e" },
          { label: "碳費費率", value: rate, unit: "NT$/tCO2e" },
          { label: "免費額度", value: allowancePct, unit: "%" },
          { label: "應徵排放量", value: chargeableEmissions, unit: "tCO2e" },
          ...(allowancePct > 0 ? [{ label: "免費額度節省", value: savings, unit: "NT$" }] : []),
        ]}
      />

      {/* Scenario comparison */}
      {emissionQty > 0 && (
        <div className="mt-4 rounded-lg border p-3 sm:p-4">
          <p className="mb-2 text-xs font-medium sm:text-sm">情境比較</p>
          <div className="space-y-2">
            {SCENARIOS.map((s) => {
              const scenarioFee = chargeableEmissions * s.rate;
              return (
                <div key={s.rate} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}（{s.rate} NT$/tCO2e）</span>
                  <span className="font-medium tabular-nums">
                    NT$ {scenarioFee.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* International comparison */}
      {emissionQty > 0 && (
        <div className="mt-4 rounded-lg border p-3 sm:p-4">
          <p className="mb-2 text-xs font-medium sm:text-sm">國際碳定價比較</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">台灣碳費（{rate} NT$/tCO2e）</span>
              <span className="font-medium tabular-nums">
                NT$ {netFee.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">EU ETS（~{EU_ETS_EUR_PER_TCO2} EUR/tCO2e）</span>
              <span className="font-medium tabular-nums">
                NT$ {euEtsCostTwd.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">SBTi 減量成本（~{SBTI_REDUCTION_COST_USD} USD/tCO2e）</span>
              <span className="font-medium tabular-nums">
                NT$ {sbtiCostTwd.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      )}

      <CalcFormula
        formula={`${chargeableEmissions.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} tCO2e × ${rate} NT$/tCO2e = NT$ ${netFee.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`}
        note="碳費 = 應徵排放量 × 碳費費率。應徵排放量 = 年度排放量 × (1 - 免費額度比例)"
      />
    </CalcCard>
  );
}
