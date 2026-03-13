"use client";

import { useState, useMemo } from "react";
import {
  Leaf,
  Factory,
  Truck,
  Plug,
  Recycle,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
  BarChart3,
  Database,
  FileText,
  Info,
  Download,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LCAStageInput {
  id: string;
  name: string;
  activityData: number;
  activityUnit: string;
  emissionFactor: number;
  factorUnit: string;
  emission: number;
}

interface SupplierRow {
  id: string;
  supplier: string;
  material: string;
  category: string;
  annualVolume: number;
  unit: string;
  emissionFactor: number;
  totalEmission: number;
  percentage: number;
  dataQuality: "primary" | "secondary" | "estimated";
}

interface EmissionFactorRecord {
  id: string;
  name: string;
  category: string;
  factor: number;
  unit: string;
  source: string;
  region: string;
  year: number;
}

// ---------------------------------------------------------------------------
// Constants & Sample Data
// ---------------------------------------------------------------------------

const TABS = [
  { id: "calculator", label: "產品碳足跡計算", icon: BarChart3 },
  { id: "supply-chain", label: "供應鏈碳排分析", icon: Package },
  { id: "factors", label: "排放係數資料庫", icon: Database },
  { id: "report", label: "LCA 報告", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STAGE_META = [
  { key: "raw", label: "原料取得", icon: Leaf, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800" },
  { key: "manufacturing", label: "製造階段", icon: Factory, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800" },
  { key: "transport", label: "運輸配送", icon: Truck, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800" },
  { key: "use", label: "使用階段", icon: Plug, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
  { key: "end-of-life", label: "廢棄處理", icon: Recycle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800" },
] as const;

const INITIAL_STAGE_DATA: Record<string, LCAStageInput[]> = {
  raw: [
    { id: "r1", name: "矽晶圓", activityData: 5000, activityUnit: "kg", emissionFactor: 2.45, factorUnit: "kgCO₂e/kg", emission: 12250 },
    { id: "r2", name: "銅線框架", activityData: 3200, activityUnit: "kg", emissionFactor: 3.81, factorUnit: "kgCO₂e/kg", emission: 12192 },
    { id: "r3", name: "封裝樹脂 (EMC)", activityData: 1800, activityUnit: "kg", emissionFactor: 2.12, factorUnit: "kgCO₂e/kg", emission: 3816 },
    { id: "r4", name: "焊錫材料", activityData: 800, activityUnit: "kg", emissionFactor: 3.20, factorUnit: "kgCO₂e/kg", emission: 2560 },
  ],
  manufacturing: [
    { id: "m1", name: "晶圓製程用電", activityData: 120000, activityUnit: "kWh", emissionFactor: 0.494, factorUnit: "kgCO₂e/kWh", emission: 59280 },
    { id: "m2", name: "封裝製程用電", activityData: 85000, activityUnit: "kWh", emissionFactor: 0.494, factorUnit: "kgCO₂e/kWh", emission: 41990 },
    { id: "m3", name: "製程用氣體 (SF₆)", activityData: 50, activityUnit: "kg", emissionFactor: 23500, factorUnit: "kgCO₂e/kg", emission: 1175000 },
    { id: "m4", name: "純水製造", activityData: 500, activityUnit: "m³", emissionFactor: 0.344, factorUnit: "kgCO₂e/m³", emission: 172 },
  ],
  transport: [
    { id: "t1", name: "原物料海運進口", activityData: 15000, activityUnit: "tkm", emissionFactor: 0.016, factorUnit: "kgCO₂e/tkm", emission: 240 },
    { id: "t2", name: "成品陸運配送", activityData: 8000, activityUnit: "tkm", emissionFactor: 0.062, factorUnit: "kgCO₂e/tkm", emission: 496 },
    { id: "t3", name: "成品空運出口", activityData: 2000, activityUnit: "tkm", emissionFactor: 0.602, factorUnit: "kgCO₂e/tkm", emission: 1204 },
  ],
  use: [
    { id: "u1", name: "產品使用期間耗電", activityData: 50000, activityUnit: "kWh", emissionFactor: 0.494, factorUnit: "kgCO₂e/kWh", emission: 24700 },
  ],
  "end-of-life": [
    { id: "e1", name: "電子廢棄物回收處理", activityData: 2000, activityUnit: "kg", emissionFactor: 0.21, factorUnit: "kgCO₂e/kg", emission: 420 },
    { id: "e2", name: "掩埋處理", activityData: 500, activityUnit: "kg", emissionFactor: 0.58, factorUnit: "kgCO₂e/kg", emission: 290 },
  ],
};

const SUPPLIER_DATA: SupplierRow[] = [
  { id: "s1", supplier: "環球晶圓", material: "矽晶圓 (8吋)", category: "原材料", annualVolume: 3000, unit: "片", emissionFactor: 4.2, totalEmission: 12600, percentage: 28.5, dataQuality: "primary" },
  { id: "s2", supplier: "日月光半導體", material: "銅線框架", category: "原材料", annualVolume: 3200, unit: "kg", emissionFactor: 3.81, totalEmission: 12192, percentage: 27.6, dataQuality: "primary" },
  { id: "s3", supplier: "長春化工", material: "封裝樹脂 (EMC)", category: "化學品", annualVolume: 1800, unit: "kg", emissionFactor: 2.12, totalEmission: 3816, percentage: 8.6, dataQuality: "secondary" },
  { id: "s4", supplier: "台灣大金", material: "製程氣體 (SF₆)", category: "特殊氣體", annualVolume: 50, unit: "kg", emissionFactor: 23500, totalEmission: 1175000, percentage: 0.1, dataQuality: "primary" },
  { id: "s5", supplier: "昇貿科技", material: "焊錫膏", category: "原材料", annualVolume: 800, unit: "kg", emissionFactor: 3.20, totalEmission: 2560, percentage: 5.8, dataQuality: "secondary" },
  { id: "s6", supplier: "台灣中油", material: "異丙醇 (IPA)", category: "化學品", annualVolume: 2500, unit: "L", emissionFactor: 1.98, totalEmission: 4950, percentage: 11.2, dataQuality: "secondary" },
  { id: "s7", supplier: "東洋油墨", material: "印刷油墨", category: "化學品", annualVolume: 300, unit: "kg", emissionFactor: 2.85, totalEmission: 855, percentage: 1.9, dataQuality: "estimated" },
  { id: "s8", supplier: "正新物流", material: "國內陸運", category: "運輸", annualVolume: 8000, unit: "tkm", emissionFactor: 0.062, totalEmission: 496, percentage: 1.1, dataQuality: "primary" },
];

const EMISSION_FACTORS: EmissionFactorRecord[] = [
  { id: "f1", name: "鋼鐵 (粗鋼)", category: "金屬", factor: 2.33, unit: "kgCO₂e/kg", source: "環境部", region: "台灣", year: 2024 },
  { id: "f2", name: "鋁 (原生鋁錠)", category: "金屬", factor: 8.24, unit: "kgCO₂e/kg", source: "IPCC AR6", region: "全球", year: 2023 },
  { id: "f3", name: "銅 (陰極銅)", category: "金屬", factor: 3.81, unit: "kgCO₂e/kg", source: "環境部", region: "台灣", year: 2024 },
  { id: "f4", name: "PP (聚丙烯)", category: "塑膠", factor: 1.98, unit: "kgCO₂e/kg", source: "GHG Protocol", region: "全球", year: 2023 },
  { id: "f5", name: "PE (聚乙烯)", category: "塑膠", factor: 1.89, unit: "kgCO₂e/kg", source: "GHG Protocol", region: "全球", year: 2023 },
  { id: "f6", name: "PET (聚酯)", category: "塑膠", factor: 2.73, unit: "kgCO₂e/kg", source: "DEFRA", region: "全球", year: 2024 },
  { id: "f7", name: "ABS 樹脂", category: "塑膠", factor: 3.12, unit: "kgCO₂e/kg", source: "GHG Protocol", region: "全球", year: 2023 },
  { id: "f8", name: "環氧樹脂 (EMC)", category: "化學品", factor: 2.12, unit: "kgCO₂e/kg", source: "環境部", region: "台灣", year: 2024 },
  { id: "f9", name: "矽晶圓 (8吋)", category: "電子元件", factor: 2.45, unit: "kgCO₂e/片", source: "環境部", region: "台灣", year: 2024 },
  { id: "f10", name: "印刷電路板 (PCB)", category: "電子元件", factor: 5.67, unit: "kgCO₂e/kg", source: "環境部", region: "台灣", year: 2024 },
  { id: "f11", name: "台灣電力", category: "能源", factor: 0.494, unit: "kgCO₂e/kWh", source: "經濟部", region: "台灣", year: 2024 },
  { id: "f12", name: "柴油", category: "能源", factor: 2.727, unit: "kgCO₂e/L", source: "環境部", region: "台灣", year: 2024 },
  { id: "f13", name: "天然氣", category: "能源", factor: 2.105, unit: "kgCO₂e/m³", source: "環境部", region: "台灣", year: 2024 },
  { id: "f14", name: "SF₆ (六氟化硫)", category: "特殊氣體", factor: 23500, unit: "kgCO₂e/kg", source: "IPCC AR6", region: "全球", year: 2023 },
  { id: "f15", name: "NF₃ (三氟化氮)", category: "特殊氣體", factor: 17400, unit: "kgCO₂e/kg", source: "IPCC AR6", region: "全球", year: 2023 },
  { id: "f16", name: "CF₄ (四氟化碳)", category: "特殊氣體", factor: 6630, unit: "kgCO₂e/kg", source: "IPCC AR6", region: "全球", year: 2023 },
  { id: "f17", name: "海運貨物", category: "運輸", factor: 0.016, unit: "kgCO₂e/tkm", source: "DEFRA", region: "全球", year: 2024 },
  { id: "f18", name: "陸運貨物 (重型貨車)", category: "運輸", factor: 0.062, unit: "kgCO₂e/tkm", source: "環境部", region: "台灣", year: 2024 },
  { id: "f19", name: "空運貨物", category: "運輸", factor: 0.602, unit: "kgCO₂e/tkm", source: "DEFRA", region: "全球", year: 2024 },
  { id: "f20", name: "自來水", category: "水資源", factor: 0.162, unit: "kgCO₂e/m³", source: "環境部", region: "台灣", year: 2024 },
];

const FACTOR_CATEGORIES = ["全部", "金屬", "塑膠", "化學品", "電子元件", "能源", "特殊氣體", "運輸", "水資源"];

const DATA_QUALITY_CONFIG = {
  primary: { label: "實測值", class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  secondary: { label: "次級數據", class: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  estimated: { label: "估算值", class: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number, decimals = 2): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return n.toLocaleString("zh-TW", { maximumFractionDigits: decimals });
  return n.toFixed(decimals);
}

function stageTotal(items: LCAStageInput[]): number {
  return items.reduce((sum, i) => sum + i.emission, 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageCard({
  meta,
  items,
  expanded,
  onToggle,
  onUpdate,
  grandTotal,
}: {
  meta: (typeof STAGE_META)[number];
  items: LCAStageInput[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (items: LCAStageInput[]) => void;
  grandTotal: number;
}) {
  const Icon = meta.icon;
  const total = stageTotal(items);
  const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;

  const handleFieldChange = (idx: number, field: "activityData" | "emissionFactor", value: string) => {
    const v = parseFloat(value) || 0;
    const updated = items.map((item, i) => {
      if (i !== idx) return item;
      const newItem = { ...item, [field]: v };
      newItem.emission = newItem.activityData * newItem.emissionFactor;
      return newItem;
    });
    onUpdate(updated);
  };

  return (
    <div className={cn("rounded-xl border", meta.border, meta.bg)}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 sm:px-5 sm:py-4"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 dark:bg-white/10", meta.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm sm:text-base">{meta.label}</p>
            <p className="text-xs text-muted-foreground">{items.length} 項活動數據</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold sm:text-base">{formatNumber(total)} kgCO₂e</p>
            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 sm:px-5 sm:py-4 space-y-2">
          {/* Header row for desktop */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_120px_100px_120px_100px_120px] gap-2 text-xs font-medium text-muted-foreground pb-1">
            <span>活動項目</span>
            <span className="text-right">活動數據</span>
            <span className="text-center">單位</span>
            <span className="text-right">排放係數</span>
            <span className="text-center">係數單位</span>
            <span className="text-right">排放量 (kgCO₂e)</span>
          </div>

          {items.map((item, idx) => (
            <div
              key={item.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_120px_100px_120px] gap-2 items-center rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-sm"
            >
              <span className="font-medium">{item.name}</span>
              <input
                type="number"
                value={item.activityData}
                onChange={(e) => handleFieldChange(idx, "activityData", e.target.value)}
                className="w-full rounded-md border bg-white dark:bg-gray-900 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={`${item.name} 活動數據`}
              />
              <span className="text-center text-xs text-muted-foreground">{item.activityUnit}</span>
              <input
                type="number"
                value={item.emissionFactor}
                onChange={(e) => handleFieldChange(idx, "emissionFactor", e.target.value)}
                step="0.001"
                className="w-full rounded-md border bg-white dark:bg-gray-900 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label={`${item.name} 排放係數`}
              />
              <span className="text-center text-xs text-muted-foreground">{item.factorUnit}</span>
              <span className="text-right font-semibold">{formatNumber(item.emission)}</span>
            </div>
          ))}

          <div className="flex justify-between items-center pt-2 border-t text-sm font-bold">
            <span>小計</span>
            <span>{formatNumber(total)} kgCO₂e</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: 產品碳足跡計算
// ---------------------------------------------------------------------------

function CalculatorTab() {
  const [stageData, setStageData] = useState<Record<string, LCAStageInput[]>>(INITIAL_STAGE_DATA);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["raw"]));
  const [productName, setProductName] = useState("整流二極體 (Rectifier Diode)");
  const [functionalUnit, setFunctionalUnit] = useState("每 10,000 顆產品");

  const grandTotal = useMemo(() => {
    return Object.values(stageData).reduce((sum, items) => sum + stageTotal(items), 0);
  }, [stageData]);

  const stageTotals = useMemo(() => {
    return STAGE_META.map((m) => ({
      key: m.key,
      label: m.label,
      total: stageTotal(stageData[m.key] || []),
      color: m.color,
    }));
  }, [stageData]);

  const toggleStage = (key: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Product info */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          產品資訊
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">產品名稱</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">功能單位</label>
            <input
              type="text"
              value={functionalUnit}
              onChange={(e) => setFunctionalUnit(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">產品碳足跡總計</p>
            <p className="text-2xl sm:text-3xl font-bold">{formatNumber(grandTotal)} <span className="text-base font-normal text-muted-foreground">kgCO₂e</span></p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">每單位產品</p>
            <p className="text-lg font-semibold">{formatNumber(grandTotal / 10000, 4)} <span className="text-sm font-normal text-muted-foreground">kgCO₂e/顆</span></p>
          </div>
        </div>
        {/* Stacked bar */}
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          {stageTotals.map((s) => {
            const pct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
            if (pct < 0.1) return null;
            const colorMap: Record<string, string> = {
              "text-emerald-600": "bg-emerald-500",
              "text-blue-600": "bg-blue-500",
              "text-amber-600": "bg-amber-500",
              "text-purple-600": "bg-purple-500",
              "text-red-600": "bg-red-500",
            };
            return (
              <div
                key={s.key}
                className={cn("h-full transition-all", colorMap[s.color] || "bg-gray-400")}
                style={{ width: `${pct}%` }}
                title={`${s.label}: ${formatNumber(s.total)} kgCO₂e (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {stageTotals.map((s) => {
            const pct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
            const dotMap: Record<string, string> = {
              "text-emerald-600": "bg-emerald-500",
              "text-blue-600": "bg-blue-500",
              "text-amber-600": "bg-amber-500",
              "text-purple-600": "bg-purple-500",
              "text-red-600": "bg-red-500",
            };
            return (
              <div key={s.key} className="flex items-center gap-1.5 text-xs">
                <span className={cn("h-2.5 w-2.5 rounded-full", dotMap[s.color])} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage cards */}
      <div className="space-y-3">
        {STAGE_META.map((meta) => (
          <StageCard
            key={meta.key}
            meta={meta}
            items={stageData[meta.key] || []}
            expanded={expandedStages.has(meta.key)}
            onToggle={() => toggleStage(meta.key)}
            onUpdate={(updated) => setStageData((prev) => ({ ...prev, [meta.key]: updated }))}
            grandTotal={grandTotal}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: 供應鏈碳排分析
// ---------------------------------------------------------------------------

function SupplyChainTab() {
  const [sortField, setSortField] = useState<"totalEmission" | "percentage">("totalEmission");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterCategory, setFilterCategory] = useState("全部");

  const categories = useMemo(() => {
    const cats = new Set(SUPPLIER_DATA.map((s) => s.category));
    return ["全部", ...Array.from(cats)];
  }, []);

  const totalEmission = useMemo(() => SUPPLIER_DATA.reduce((sum, s) => sum + s.totalEmission, 0), []);

  const filtered = useMemo(() => {
    let data = filterCategory === "全部" ? SUPPLIER_DATA : SUPPLIER_DATA.filter((s) => s.category === filterCategory);
    data = [...data].sort((a, b) => {
      const diff = a[sortField] - b[sortField];
      return sortAsc ? diff : -diff;
    });
    return data;
  }, [filterCategory, sortField, sortAsc]);

  // Recalculate percentages based on total
  const dataWithPct = useMemo(() => {
    return filtered.map((s) => ({
      ...s,
      percentage: totalEmission > 0 ? (s.totalEmission / totalEmission) * 100 : 0,
    }));
  }, [filtered, totalEmission]);

  const handleSort = (field: "totalEmission" | "percentage") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">供應商數量</p>
          <p className="text-xl font-bold mt-1">{SUPPLIER_DATA.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">總碳排量</p>
          <p className="text-xl font-bold mt-1">{formatNumber(totalEmission)}</p>
          <p className="text-xs text-muted-foreground">kgCO₂e</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">實測數據比例</p>
          <p className="text-xl font-bold mt-1">{((SUPPLIER_DATA.filter((s) => s.dataQuality === "primary").length / SUPPLIER_DATA.length) * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">材料類別數</p>
          <p className="text-xl font-bold mt-1">{new Set(SUPPLIER_DATA.map((s) => s.category)).size}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">類別篩選：</span>
        </div>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filterCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="供應鏈碳排分析">
            <thead>
              <tr className="border-b bg-gray-50/80 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">供應商</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">材料/服務</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">類別</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">年用量</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">排放係數</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  <button type="button" onClick={() => handleSort("totalEmission")} className="inline-flex items-center gap-1 hover:text-foreground">
                    碳排量
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  <button type="button" onClick={() => handleSort("percentage")} className="inline-flex items-center gap-1 hover:text-foreground">
                    占比
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden lg:table-cell">數據品質</th>
              </tr>
            </thead>
            <tbody>
              {dataWithPct.map((row) => {
                const q = DATA_QUALITY_CONFIG[row.dataQuality];
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{row.supplier}</td>
                    <td className="px-4 py-3">{row.material}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs">{row.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">{row.annualVolume.toLocaleString()} {row.unit}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">{row.emissionFactor}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNumber(row.totalEmission)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden sm:block h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(row.percentage, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium">{row.percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", q.class)}>{q.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: 排放係數資料庫
// ---------------------------------------------------------------------------

function FactorDatabaseTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedSource, setSelectedSource] = useState("全部");

  const sources = useMemo(() => {
    const s = new Set(EMISSION_FACTORS.map((f) => f.source));
    return ["全部", ...Array.from(s)];
  }, []);

  const filtered = useMemo(() => {
    return EMISSION_FACTORS.filter((f) => {
      const matchSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.category.includes(searchQuery);
      const matchCategory = selectedCategory === "全部" || f.category === selectedCategory;
      const matchSource = selectedSource === "全部" || f.source === selectedSource;
      return matchSearch && matchCategory && matchSource;
    });
  }, [searchQuery, selectedCategory, selectedSource]);

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜尋排放係數 (名稱、類別...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="搜尋排放係數"
            />
          </div>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="rounded-lg border bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="資料來源篩選"
          >
            {sources.map((s) => (
              <option key={s} value={s}>{s === "全部" ? "全部來源" : s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {FACTOR_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        共找到 <span className="font-semibold text-foreground">{filtered.length}</span> 筆排放係數
      </p>

      {/* Factor cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((f) => (
          <div key={f.id} className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{f.name}</p>
                <span className="inline-block mt-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-muted-foreground">
                  {f.category}
                </span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-primary">{f.factor.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{f.unit}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-blue-700 dark:text-blue-300">{f.source}</span>
              <span>{f.region}</span>
              <span>{f.year}</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Database className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">無符合條件的排放係數</p>
          <p className="text-xs mt-1">請調整搜尋條件或篩選類別</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: LCA 報告
// ---------------------------------------------------------------------------

function ReportTab({ orgName }: { orgName: string }) {
  const stageTotals = STAGE_META.map((m) => ({
    key: m.key,
    label: m.label,
    icon: m.icon,
    color: m.color,
    total: stageTotal(INITIAL_STAGE_DATA[m.key] || []),
  }));

  const grandTotal = stageTotals.reduce((sum, s) => sum + s.total, 0);
  const topContributor = [...stageTotals].sort((a, b) => b.total - a.total)[0];

  return (
    <div className="space-y-6">
      {/* Report header */}
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">產品碳足跡評估報告</h3>
            <p className="text-sm text-muted-foreground mt-1">{orgName} | 整流二極體 (Rectifier Diode)</p>
            <p className="text-xs text-muted-foreground mt-0.5">功能單位：每 10,000 顆產品 | 評估標準：ISO 14067 / PAS 2050</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors self-start"
          >
            <Download className="h-4 w-4" />
            匯出報告
          </button>
        </div>
      </div>

      {/* Total summary */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 p-5 sm:p-6 text-center">
        <p className="text-sm text-muted-foreground mb-1">產品碳足跡總計</p>
        <p className="text-4xl sm:text-5xl font-bold">{formatNumber(grandTotal)}</p>
        <p className="text-sm text-muted-foreground mt-1">kgCO₂e / 每 10,000 顆</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-800/80 px-3 py-1 text-xs">
          <span className="text-muted-foreground">每顆產品碳足跡：</span>
          <span className="font-bold">{formatNumber(grandTotal / 10000, 4)} kgCO₂e</span>
        </div>
      </div>

      {/* Stage breakdown */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h4 className="font-semibold mb-4">各生命週期階段排放量</h4>
        <div className="space-y-3">
          {stageTotals
            .sort((a, b) => b.total - a.total)
            .map((s) => {
              const pct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
              const Icon = s.icon;
              const barColorMap: Record<string, string> = {
                "text-emerald-600": "bg-emerald-500",
                "text-blue-600": "bg-blue-500",
                "text-amber-600": "bg-amber-500",
                "text-purple-600": "bg-purple-500",
                "text-red-600": "bg-red-500",
              };
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800", s.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="text-sm font-semibold">{formatNumber(s.total)} kgCO₂e ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={cn("h-full rounded-full transition-all", barColorMap[s.color] || "bg-gray-400")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Key findings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <h4 className="font-semibold mb-3">關鍵發現</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span><strong className="text-foreground">{topContributor.label}</strong>為最大排放來源，占總排放量 {((topContributor.total / grandTotal) * 100).toFixed(1)}%</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>製程用特殊氣體 (SF₆) 的全球暖化潛勢 (GWP) 極高，需優先管控</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>原料取得階段以矽晶圓與銅線框架為主要排放項目</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
              <span>運輸階段排放占比相對較低，空運為主要排放源</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <h4 className="font-semibold mb-3">減量建議</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>導入 SF₆ 替代氣體或安裝尾氣處理設備，預估可減量 <strong className="text-foreground">60-80%</strong> 製程排放</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>擴大綠電採購比例，將電力碳排係數從 0.494 降至目標值</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>與供應商合作取得產品碳足跡 (PCF) 實測數據，提升數據品質</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>優化包裝設計減少材料用量，降低原料取得階段碳排</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Methodology note */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-200">評估方法與邊界說明</h4>
            <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1 leading-relaxed">
              本報告依據 ISO 14067:2018 及 PAS 2050:2011 標準進行產品碳足跡評估，涵蓋搖籃到墳墓 (Cradle-to-Grave) 完整生命週期。
              排放係數來源包含台灣環境部溫室氣體排放係數管理表、IPCC AR6、GHG Protocol 及 DEFRA。
              系統邊界包含原料取得、製造、運輸配送、使用及廢棄處理五大階段。資本財、基礎設施建設等依重要性原則排除。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function LCAPage({ orgName }: { orgName: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("calculator");

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
          <Leaf className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold sm:text-xl">產品碳足跡 / LCA</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            產品生命週期碳足跡評估與供應鏈碳排分析
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-gray-50/80 dark:bg-gray-800/50 p-1" role="tablist" aria-label="LCA 功能分頁">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-900 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-800"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === "calculator" && <CalculatorTab />}
        {activeTab === "supply-chain" && <SupplyChainTab />}
        {activeTab === "factors" && <FactorDatabaseTab />}
        {activeTab === "report" && <ReportTab orgName={orgName} />}
      </div>
    </div>
  );
}
