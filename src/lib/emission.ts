/**
 * Core emission calculation engine
 * 排放量 = 活動數據 × 排放係數
 */

export interface EmissionInput {
  activityAmount: number;
  co2Factor: number;
  ch4Factor: number;
  n2oFactor: number;
  hfcFactor: number;
  pfcFactor: number;
  sf6Factor: number;
  nf3Factor: number;
}

export interface EmissionResult {
  co2Amount: number;
  ch4Amount: number;
  n2oAmount: number;
  otherGhgAmount: number;
  totalAmount: number; // tCO2e
}

export function calculateEmission(input: EmissionInput): EmissionResult {
  const co2Amount = input.activityAmount * input.co2Factor;
  const ch4Amount = input.activityAmount * input.ch4Factor;
  const n2oAmount = input.activityAmount * input.n2oFactor;
  const otherGhgAmount =
    input.activityAmount *
    (input.hfcFactor + input.pfcFactor + input.sf6Factor + input.nf3Factor);

  const totalAmount = co2Amount + ch4Amount + n2oAmount + otherGhgAmount;

  // Convert kg to tonnes
  return {
    co2Amount: co2Amount / 1000,
    ch4Amount: ch4Amount / 1000,
    n2oAmount: n2oAmount / 1000,
    otherGhgAmount: otherGhgAmount / 1000,
    totalAmount: totalAmount / 1000,
  };
}

/** Format tCO2e for display */
export function formatEmission(tco2e: number): string {
  if (tco2e >= 1000) {
    return `${(tco2e / 1000).toFixed(2)} 千公噸`;
  }
  return `${tco2e.toFixed(2)} 公噸`;
}

/** Scope labels in Traditional Chinese */
export const SCOPE_LABELS: Record<number, string> = {
  1: "範疇一（直接排放）",
  2: "範疇二（間接排放）",
  3: "範疇三（價值鏈排放）",
};

/** Emission source category labels */
export const CATEGORY_LABELS: Record<string, string> = {
  STATIONARY_COMBUSTION: "固定燃燒源",
  MOBILE_COMBUSTION: "移動燃燒源",
  PROCESS: "製程排放",
  FUGITIVE: "逸散排放",
  PURCHASED_ELECTRICITY: "外購電力",
  PURCHASED_STEAM: "外購蒸汽/熱能",
};
