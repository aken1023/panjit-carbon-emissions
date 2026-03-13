"use client";

import { useState } from "react";
import { formatEmission } from "@/lib/emission";

export function CarbonFeeCalc() {
  const [emission, setEmission] = useState<string>("");
  const [rate, setRate] = useState<string>("300");

  const emissionNum = parseFloat(emission) || 0;
  const rateNum = parseFloat(rate) || 0;
  const totalFee = emissionNum * rateNum;

  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">碳費試算區</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        依氣候變遷因應法，2025年起開徵碳費
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="calc-emission" className="text-sm font-medium">
            排放量（tCO2e）
          </label>
          <input
            id="calc-emission"
            type="number"
            min="0"
            step="0.01"
            value={emission}
            onChange={(e) => setEmission(e.target.value)}
            placeholder="輸入排放量"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label htmlFor="calc-rate" className="text-sm font-medium">
            碳費費率（NT$/tCO2e）
          </label>
          <input
            id="calc-rate"
            type="number"
            min="0"
            step="1"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="300"
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-muted/50 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">預估碳費</span>
          <span className="text-2xl font-bold tabular-nums">
            NT$ {totalFee.toLocaleString("zh-TW", { maximumFractionDigits: 0 })}
          </span>
        </div>
        {emissionNum > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {formatEmission(emissionNum)} x NT${rateNum}/tCO2e
          </p>
        )}
      </div>
    </div>
  );
}
