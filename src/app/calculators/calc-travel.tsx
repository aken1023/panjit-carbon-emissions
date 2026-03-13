"use client";

import { useState } from "react";
import { CalcCard, CalcInput, CalcSelect, CalcResult, CalcFormula } from "./calc-shared";

const TRAVEL_MODES = [
  { value: "domestic_flight", label: "國內航班", factor: 0.168, unit: "kgCO2e/人·km" },
  { value: "short_intl_flight", label: "短程國際航班 (<3500km)", factor: 0.121, unit: "kgCO2e/人·km" },
  { value: "long_intl_flight", label: "長程國際航班 (>3500km)", factor: 0.098, unit: "kgCO2e/人·km" },
  { value: "hsr", label: "高鐵", factor: 0.0354, unit: "kgCO2e/人·km" },
  { value: "train", label: "台鐵", factor: 0.0211, unit: "kgCO2e/人·km" },
  { value: "bus", label: "客運", factor: 0.0423, unit: "kgCO2e/人·km" },
  { value: "taxi", label: "計程車", factor: 0.178, unit: "kgCO2e/人·km" },
];

interface Trip {
  id: number;
  mode: string;
  distance: string;
  travelers: string;
}

let nextId = 1;

export function BusinessTravelCalc() {
  const [trips, setTrips] = useState<Trip[]>([
    { id: nextId++, mode: "short_intl_flight", distance: "", travelers: "1" },
  ]);

  const addTrip = () => {
    setTrips([...trips, { id: nextId++, mode: "short_intl_flight", distance: "", travelers: "1" }]);
  };

  const removeTrip = (id: number) => {
    if (trips.length > 1) {
      setTrips(trips.filter((t) => t.id !== id));
    }
  };

  const updateTrip = (id: number, field: keyof Omit<Trip, "id">, value: string) => {
    setTrips(trips.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const tripResults = trips.map((trip) => {
    const modeData = TRAVEL_MODES.find((m) => m.value === trip.mode)!;
    const dist = parseFloat(trip.distance) || 0;
    const pax = parseFloat(trip.travelers) || 0;
    const emission = dist * pax * modeData.factor / 1000;
    return { ...trip, modeData, dist, pax, emission };
  });

  const total = tripResults.reduce((sum, t) => sum + t.emission, 0);

  return (
    <CalcCard
      title="商務差旅計算機"
      description="計算員工商務差旅之溫室氣體排放（航空、鐵路、公路）"
      scope="Scope 3 — 其他間接排放"
    >
      {trips.map((trip, index) => {
        const result = tripResults[index];
        return (
          <div key={trip.id} className="mb-4 rounded-lg border p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium sm:text-sm">差旅行程 {index + 1}</span>
              {trips.length > 1 && (
                <button
                  onClick={() => removeTrip(trip.id)}
                  className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  移除
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <CalcSelect
                label="交通方式"
                id={`travel-mode-${trip.id}`}
                value={trip.mode}
                onChange={(v) => updateTrip(trip.id, "mode", v)}
                options={TRAVEL_MODES.map((m) => ({ value: m.value, label: m.label }))}
              />
              <CalcInput
                label="距離"
                id={`travel-dist-${trip.id}`}
                value={trip.distance}
                onChange={(v) => updateTrip(trip.id, "distance", v)}
                placeholder="單程或來回距離"
                unit="km"
              />
              <CalcInput
                label="出差人數"
                id={`travel-pax-${trip.id}`}
                value={trip.travelers}
                onChange={(v) => updateTrip(trip.id, "travelers", v)}
                placeholder="人數"
                unit="人"
                step="1"
              />
            </div>
            {result.emission > 0 && (
              <div className="mt-2 text-right text-xs text-muted-foreground">
                小計：{result.emission.toFixed(4)} tCO2e（{result.modeData.factor} {result.modeData.unit}）
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addTrip}
        className="mb-4 w-full rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:bg-muted/50"
      >
        + 新增差旅行程
      </button>

      <CalcResult
        label="差旅總排放量"
        value={total}
        unit="tCO2e"
        breakdown={tripResults
          .filter((t) => t.emission > 0)
          .map((t, i) => ({
            label: `行程 ${i + 1}: ${t.modeData.label}`,
            value: t.emission,
            unit: "tCO2e",
          }))}
      />

      <CalcFormula
        formula="距離(km) × 人數 × 排放係數(kgCO2e/人·km) ÷ 1000 = 排放量(tCO2e)"
        note="排放係數來源：環境部/交通部統計"
      />
    </CalcCard>
  );
}
