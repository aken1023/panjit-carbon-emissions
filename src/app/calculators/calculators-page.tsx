"use client";

import { useState } from "react";
import {
  Flame,
  Car,
  Wind,
  Zap,
  Droplets,
  Trash2,
  Plane,
  Users,
  Package,
  Calculator,
  Banknote,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StationaryCombustionCalc } from "./calc-stationary";
import { MobileCombustionCalc } from "./calc-mobile";
import { FugitiveCalc } from "./calc-fugitive";
import { ElectricityCalc } from "./calc-electricity";
import { SteamCalc } from "./calc-steam";
import { WaterCalc } from "./calc-water";
import { WasteCalc } from "./calc-waste";
import { BusinessTravelCalc } from "./calc-travel";
import { CommuteCalc } from "./calc-commute";
import { PurchasedGoodsCalc } from "./calc-purchased";
import { CarbonFeeCalc } from "./calc-carbon-fee";
import { UnitConverterCalc } from "./calc-converter";

const CALC_TABS = [
  { id: "stationary", label: "固定燃燒", icon: Flame, scope: 1, component: StationaryCombustionCalc },
  { id: "mobile", label: "移動燃燒", icon: Car, scope: 1, component: MobileCombustionCalc },
  { id: "fugitive", label: "逸散排放", icon: Wind, scope: 1, component: FugitiveCalc },
  { id: "electricity", label: "外購電力", icon: Zap, scope: 2, component: ElectricityCalc },
  { id: "steam", label: "外購蒸汽", icon: Flame, scope: 2, component: SteamCalc },
  { id: "water", label: "用水", icon: Droplets, scope: 3, component: WaterCalc },
  { id: "waste", label: "廢棄物", icon: Trash2, scope: 3, component: WasteCalc },
  { id: "travel", label: "商務差旅", icon: Plane, scope: 3, component: BusinessTravelCalc },
  { id: "commute", label: "員工通勤", icon: Users, scope: 3, component: CommuteCalc },
  { id: "purchased", label: "採購商品", icon: Package, scope: 3, component: PurchasedGoodsCalc },
  { id: "carbon-fee", label: "碳費試算", icon: Banknote, scope: 0, component: CarbonFeeCalc },
  { id: "converter", label: "單位換算", icon: ArrowRightLeft, scope: 0, component: UnitConverterCalc },
];

const SCOPE_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-700",
  1: "bg-red-100 text-red-700",
  2: "bg-amber-100 text-amber-700",
  3: "bg-blue-100 text-blue-700",
};

const SCOPE_LABELS: Record<number, string> = {
  0: "工具",
  1: "範疇一",
  2: "範疇二",
  3: "範疇三",
};

export function CalculatorsPage() {
  const [activeTab, setActiveTab] = useState("stationary");
  const ActiveComponent = CALC_TABS.find((t) => t.id === activeTab)?.component ?? StationaryCombustionCalc;

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold sm:text-xl">碳排計算機</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            涵蓋範疇一至三，快速估算各排放源碳排量
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:gap-2">
        {CALC_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:py-2 sm:text-sm",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>{tab.label}</span>
            <span className={cn("rounded px-1 py-0.5 text-[9px] sm:text-[10px]", SCOPE_COLORS[tab.scope])}>
              {SCOPE_LABELS[tab.scope]}
            </span>
          </button>
        ))}
      </div>

      {/* Active calculator */}
      <ActiveComponent />
    </div>
  );
}
