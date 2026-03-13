"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Search,
  AlertTriangle,
  ChevronDown,
  Info,
  BarChart3,
  FileText,
  Shield,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  Download,
  AlertCircle,
  Lightbulb,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SCOPE_LABELS, CATEGORY_LABELS } from "@/lib/emission";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceCategory: string;
  sourceScope: number;
  unitName: string;
  month: number;
  activityAmount: number;
  activityUnit: string;
  emissionAmount: number;
  co2Amount: number;
  ch4Amount: number;
  n2oAmount: number;
  otherGhgAmount: number;
  dataQuality: string;
  status: string;
  factorSource: string;
  factorUnit: string;
}

interface AnalysisPageProps {
  periodName: string;
  periodYear: number;
  data: ActivityRecord[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const THRESHOLD_OPTIONS = [
  { value: 1, label: "1%" },
  { value: 3, label: "3%" },
  { value: 5, label: "5%" },
];

const DATA_QUALITY_LABELS: Record<string, string> = {
  PRIMARY: "實測值",
  SECONDARY: "次級數據",
  ESTIMATED: "估算值",
};

const DATA_QUALITY_UNCERTAINTY: Record<string, number> = {
  PRIMARY: 5,
  SECONDARY: 15,
  ESTIMATED: 30,
};

const DATA_QUALITY_SCORE: Record<string, number> = {
  PRIMARY: 100,
  SECONDARY: 60,
  ESTIMATED: 30,
};

const FACTOR_SOURCE_LABELS: Record<string, string> = {
  EPA_TW: "環境部",
  IPCC_AR6: "IPCC AR6",
  GHG_PROTOCOL: "GHG Protocol",
  DEFRA: "DEFRA",
  CUSTOM: "自訂",
};

const FACTOR_SOURCE_UNCERTAINTY: Record<string, number> = {
  EPA_TW: 5,
  IPCC_AR6: 10,
  GHG_PROTOCOL: 10,
  DEFRA: 10,
  CUSTOM: 25,
};

const QUALITY_COLORS: Record<string, string> = {
  PRIMARY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  SECONDARY: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ESTIMATED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const QUALITY_BAR_COLORS: Record<string, string> = {
  PRIMARY: "bg-emerald-500",
  SECONDARY: "bg-amber-500",
  ESTIMATED: "bg-red-500",
};

const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { id: "materiality", label: "重大性分析", icon: Search },
  { id: "uncertainty", label: "不確定性分析", icon: AlertTriangle },
  { id: "quality", label: "數據品質評估", icon: Shield },
  { id: "report", label: "分析報告", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------------------------------------------------------------------------
// Helper: aggregate source-level data from monthly records
// ---------------------------------------------------------------------------

interface AggregatedSource {
  sourceId: string;
  sourceName: string;
  sourceCategory: string;
  sourceScope: number;
  unitName: string;
  totalEmission: number;
  dataQualities: string[];
  factorSources: string[];
  dominantQuality: string;
  dominantFactorSource: string;
  monthsWithData: number[];
}

function aggregateSources(data: ActivityRecord[]): AggregatedSource[] {
  const map = new Map<
    string,
    {
      sourceName: string;
      sourceCategory: string;
      sourceScope: number;
      unitName: string;
      totalEmission: number;
      qualityCounts: Map<string, number>;
      factorCounts: Map<string, number>;
      months: Set<number>;
    }
  >();

  for (const d of data) {
    let entry = map.get(d.sourceId);
    if (!entry) {
      entry = {
        sourceName: d.sourceName,
        sourceCategory: d.sourceCategory,
        sourceScope: d.sourceScope,
        unitName: d.unitName,
        totalEmission: 0,
        qualityCounts: new Map(),
        factorCounts: new Map(),
        months: new Set(),
      };
      map.set(d.sourceId, entry);
    }
    entry.totalEmission += d.emissionAmount;
    entry.qualityCounts.set(
      d.dataQuality,
      (entry.qualityCounts.get(d.dataQuality) ?? 0) + 1
    );
    if (d.factorSource) {
      entry.factorCounts.set(
        d.factorSource,
        (entry.factorCounts.get(d.factorSource) ?? 0) + 1
      );
    }
    entry.months.add(d.month);
  }

  return Array.from(map.entries()).map(([sourceId, e]) => {
    const dominantQuality = [...e.qualityCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? "ESTIMATED";
    const dominantFactorSource = [...e.factorCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? "CUSTOM";

    return {
      sourceId,
      sourceName: e.sourceName,
      sourceCategory: e.sourceCategory,
      sourceScope: e.sourceScope,
      unitName: e.unitName,
      totalEmission: e.totalEmission,
      dataQualities: [...e.qualityCounts.keys()],
      factorSources: [...e.factorCounts.keys()],
      dominantQuality,
      dominantFactorSource,
      monthsWithData: [...e.months].sort((a, b) => a - b),
    };
  });
}

// ---------------------------------------------------------------------------
// Helper: uncertainty calculation for a source
// ---------------------------------------------------------------------------

interface UncertaintyRow extends AggregatedSource {
  actUncertainty: number;
  factUncertainty: number;
  combined: number;
  lowerBound: number;
  upperBound: number;
  sensitivityIndex: number;
}

function computeUncertaintyRows(
  sources: AggregatedSource[],
  grandTotal: number
): UncertaintyRow[] {
  return sources.map((src) => {
    const actUncertainty = DATA_QUALITY_UNCERTAINTY[src.dominantQuality] ?? 30;
    const factUncertainty =
      FACTOR_SOURCE_UNCERTAINTY[src.dominantFactorSource] ?? 25;
    const combined = Math.sqrt(actUncertainty ** 2 + factUncertainty ** 2);
    const lowerBound = src.totalEmission * (1 - combined / 100);
    const upperBound = src.totalEmission * (1 + combined / 100);
    const sensitivityIndex =
      grandTotal > 0
        ? (src.totalEmission / grandTotal) * combined
        : 0;
    return {
      ...src,
      actUncertainty,
      factUncertainty,
      combined,
      lowerBound,
      upperBound,
      sensitivityIndex,
    };
  });
}

// ---------------------------------------------------------------------------
// Helper: scope-level uncertainty
// ---------------------------------------------------------------------------

interface ScopeUncertainty {
  scope: number;
  total: number;
  combined: number;
  lower: number;
  upper: number;
  sourceCount: number;
  significantCount?: number;
}

function computeScopeUncertainty(
  uncertaintyRows: UncertaintyRow[]
): ScopeUncertainty[] {
  const scopes = [1, 2] as const;
  return scopes.map((scope) => {
    const scopeSources = uncertaintyRows.filter(
      (r) => r.sourceScope === scope
    );
    const scopeTotal = scopeSources.reduce((s, r) => s + r.totalEmission, 0);
    if (scopeTotal === 0) {
      return { scope, total: 0, combined: 0, lower: 0, upper: 0, sourceCount: 0 };
    }
    const sumSq = scopeSources.reduce((s, r) => {
      const weight = r.totalEmission / scopeTotal;
      return s + (weight * r.combined) ** 2;
    }, 0);
    const combined = Math.sqrt(sumSq);
    return {
      scope,
      total: scopeTotal,
      combined,
      lower: scopeTotal * (1 - combined / 100),
      upper: scopeTotal * (1 + combined / 100),
      sourceCount: scopeSources.length,
    };
  });
}

function computeOverallUncertainty(
  uncertaintyRows: UncertaintyRow[],
  grandTotal: number
): number {
  if (grandTotal === 0) return 0;
  const sumSq = uncertaintyRows.reduce((s, r) => {
    const weight = r.totalEmission / grandTotal;
    return s + (weight * r.combined) ** 2;
  }, 0);
  return Math.sqrt(sumSq);
}

// ---------------------------------------------------------------------------
// Helper: format number
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 4): string {
  return n.toLocaleString("zh-TW", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnalysisPage({ periodName, periodYear, data }: AnalysisPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("materiality");
  const [threshold, setThreshold] = useState(1);

  const sources = useMemo(() => aggregateSources(data), [data]);
  const grandTotal = useMemo(
    () => sources.reduce((s, src) => s + src.totalEmission, 0),
    [sources]
  );
  const uncertaintyRows = useMemo(
    () => computeUncertaintyRows(sources, grandTotal),
    [sources, grandTotal]
  );
  const scopeUncertainty = useMemo(
    () => computeScopeUncertainty(uncertaintyRows),
    [uncertaintyRows]
  );
  const overallUncertainty = useMemo(
    () => computeOverallUncertainty(uncertaintyRows, grandTotal),
    [uncertaintyRows, grandTotal]
  );

  const hasData = data.length > 0 && grandTotal > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">重大性與不確定性分析</h1>
        <p className="text-muted-foreground">
          {periodName
            ? `${periodName} - ISO 14064-1 重大性評估與 IPCC 不確定性分析`
            : "依據 ISO 14064-1 與 IPCC 指引進行排放源分析"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-card p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* No data fallback */}
      {!hasData && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚無排放數據可供分析
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先至「數據填報」提交活動數據，計算排放量後即可進行分析。
          </p>
        </div>
      )}

      {hasData && activeTab === "materiality" && (
        <MaterialityTab
          sources={sources}
          grandTotal={grandTotal}
          threshold={threshold}
          onThresholdChange={setThreshold}
          data={data}
        />
      )}

      {hasData && activeTab === "uncertainty" && (
        <UncertaintyTab
          sources={sources}
          grandTotal={grandTotal}
          data={data}
          uncertaintyRows={uncertaintyRows}
          scopeUncertainty={scopeUncertainty}
          overallUncertainty={overallUncertainty}
        />
      )}

      {hasData && activeTab === "quality" && (
        <QualityTab
          sources={sources}
          grandTotal={grandTotal}
          data={data}
          uncertaintyRows={uncertaintyRows}
        />
      )}

      {hasData && activeTab === "report" && (
        <ReportTab
          sources={sources}
          grandTotal={grandTotal}
          data={data}
          threshold={threshold}
          uncertaintyRows={uncertaintyRows}
          scopeUncertainty={scopeUncertainty}
          overallUncertainty={overallUncertainty}
          periodName={periodName}
          periodYear={periodYear}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Tab 1: Materiality Analysis (重大性分析)
// ===========================================================================

function MaterialityTab({
  sources,
  grandTotal,
  threshold,
  onThresholdChange,
  data,
}: {
  sources: AggregatedSource[];
  grandTotal: number;
  threshold: number;
  onThresholdChange: (t: number) => void;
  data: ActivityRecord[];
}) {
  const ranked = useMemo(() => {
    const sorted = [...sources].sort(
      (a, b) => b.totalEmission - a.totalEmission
    );
    let cumulative = 0;
    return sorted.map((src, idx) => {
      const pct = (src.totalEmission / grandTotal) * 100;
      cumulative += pct;
      return {
        ...src,
        rank: idx + 1,
        percentage: pct,
        cumulativePercentage: cumulative,
        isSignificant: pct >= threshold,
      };
    });
  }, [sources, grandTotal, threshold]);

  const significantCount = ranked.filter((r) => r.isSignificant).length;
  const significantTotal = ranked
    .filter((r) => r.isSignificant)
    .reduce((s, r) => s + r.totalEmission, 0);
  const significantPct =
    grandTotal > 0 ? (significantTotal / grandTotal) * 100 : 0;

  // Category-level aggregation
  const categoryData = useMemo(() => {
    const catMap = new Map<string, { count: number; total: number }>();
    for (const src of sources) {
      const existing = catMap.get(src.sourceCategory) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += src.totalEmission;
      catMap.set(src.sourceCategory, existing);
    }
    const sorted = [...catMap.entries()]
      .map(([cat, v]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        count: v.count,
        total: v.total,
        percentage: grandTotal > 0 ? (v.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
    let cum = 0;
    return sorted.map((c) => {
      cum += c.percentage;
      return { ...c, cumulativePercentage: cum };
    });
  }, [sources, grandTotal]);

  // Scope-level materiality breakdown
  const scopeBreakdown = useMemo(() => {
    return [1, 2].map((scope) => {
      const scopeSources = ranked.filter((r) => r.sourceScope === scope);
      const scopeTotal = scopeSources.reduce((s, r) => s + r.totalEmission, 0);
      const scopeSignificant = scopeSources.filter((r) => r.isSignificant);
      return {
        scope,
        sources: scopeSources,
        total: scopeTotal,
        significantCount: scopeSignificant.length,
        totalCount: scopeSources.length,
      };
    }).filter((s) => s.totalCount > 0);
  }, [ranked]);

  // Find where cumulative crosses 80%
  const paretoIndex = useMemo(() => {
    return ranked.findIndex((r) => r.cumulativePercentage >= 80);
  }, [ranked]);

  return (
    <div className="space-y-4">
      {/* Threshold selector */}
      <div className="rounded-xl border bg-card p-5">
        <label className="text-sm font-medium text-muted-foreground">
          重大性門檻值
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          依 ISO 14064-1 建議，排放佔比達門檻值以上視為重大排放源
        </p>
        <div className="mt-3 flex gap-2">
          {THRESHOLD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onThresholdChange(opt.value)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                threshold === opt.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">排放源總數</p>
          <p className="mt-2 text-2xl font-bold">{ranked.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">個已識別排放源</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">重大排放源</p>
          <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">
            {significantCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            佔比 &ge; {threshold}% 之排放源
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">重大排放佔比</p>
          <p className="mt-2 text-2xl font-bold">{significantPct.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            重大排放源佔總排放量
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">總排放量</p>
          <p className="mt-2 text-2xl font-bold">{fmt(grandTotal, 2)}</p>
          <p className="mt-1 text-xs text-muted-foreground">tCO2e</p>
        </div>
      </div>

      {/* Pareto chart visualization */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">柏拉圖分析 (Pareto Chart)</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          排放源依排放量遞減排列，虛線標示累積 80% 位置（80/20 法則）
        </p>
        <div className="mt-4 space-y-1.5">
          {ranked.map((r, idx) => {
            const maxPct = ranked[0]?.percentage ?? 1;
            const barWidth = Math.max((r.percentage / maxPct) * 100, 1);
            const crossedEighty = idx === paretoIndex;
            return (
              <div key={r.sourceId}>
                {crossedEighty && (
                  <div className="relative my-2">
                    <div className="border-t-2 border-dashed border-blue-500" />
                    <span className="absolute -top-3 right-0 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      80% 線
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-32 shrink-0 truncate text-xs font-medium text-right" title={r.sourceName}>
                    {r.sourceName}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded transition-all",
                          r.isSignificant
                            ? "bg-red-500 dark:bg-red-600"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs font-mono text-muted-foreground">
                      {r.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-16 text-right text-xs font-mono text-muted-foreground">
                    {r.cumulativePercentage.toFixed(0)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Cumulative percentage line representation */}
        <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg bg-muted">
          {ranked.map((r) => {
            const widthPct = Math.max(r.percentage, 0.3);
            return (
              <div
                key={r.sourceId}
                className={cn(
                  "relative flex items-center justify-center text-[10px] font-medium transition-all",
                  r.isSignificant
                    ? "bg-red-500 text-white dark:bg-red-600"
                    : "bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
                )}
                style={{ width: `${widthPct}%` }}
                title={`${r.sourceName}: ${r.percentage.toFixed(1)}%`}
              >
                {r.percentage >= 5 ? `${r.percentage.toFixed(0)}%` : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-500" />
            重大排放源
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-gray-300 dark:bg-gray-600" />
            非重大排放源
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-blue-500" />
            累積 80% 線
          </span>
        </div>
      </div>

      {/* Scope-level materiality breakdown */}
      <div className="grid gap-4 sm:grid-cols-2">
        {scopeBreakdown.map((sb) => (
          <div key={sb.scope} className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">
              {SCOPE_LABELS[sb.scope] ?? `範疇${sb.scope}`}
            </h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold">{fmt(sb.total, 2)}</span>
              <span className="text-sm text-muted-foreground">tCO2e</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sb.totalCount} 個排放源，其中 {sb.significantCount} 個為重大排放源
            </p>
            {/* Mini bar chart for sources within this scope */}
            <div className="mt-3 space-y-1">
              {sb.sources.slice(0, 5).map((src) => {
                const scopeMaxPct = sb.sources[0]?.percentage ?? 1;
                const barW = Math.max((src.percentage / scopeMaxPct) * 100, 2);
                return (
                  <div key={src.sourceId} className="flex items-center gap-2">
                    <div className="w-24 shrink-0 truncate text-[11px] text-right" title={src.sourceName}>
                      {src.sourceName}
                    </div>
                    <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded",
                          src.isSignificant
                            ? "bg-red-400 dark:bg-red-600"
                            : "bg-gray-300 dark:bg-gray-600"
                        )}
                        style={{ width: `${barW}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground w-10 text-right">
                      {src.percentage.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
              {sb.sources.length > 5 && (
                <p className="text-[11px] text-muted-foreground text-center mt-1">
                  ...及其餘 {sb.sources.length - 5} 個排放源
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Category-level aggregation table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-base font-semibold">類別層級彙總</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            依排放源類別彙總排放量與佔比
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-5 py-3 text-left font-medium">類別</th>
                <th className="px-5 py-3 text-right font-medium">排放源數</th>
                <th className="px-5 py-3 text-right font-medium">排放量 (tCO2e)</th>
                <th className="px-5 py-3 text-right font-medium">佔比 (%)</th>
                <th className="px-5 py-3 text-right font-medium">累積佔比 (%)</th>
                <th className="px-5 py-3 text-left font-medium w-48">佔比圖</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((c) => (
                <tr key={c.category} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-2.5 font-medium">{c.label}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{c.count}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{fmt(c.total)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{c.percentage.toFixed(2)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{c.cumulativePercentage.toFixed(2)}</td>
                  <td className="px-5 py-2.5">
                    <div className="h-3 w-full bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded"
                        style={{ width: `${Math.max(c.percentage, 0.5)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full detail table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-base font-semibold">排放源重大性排序</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            依年排放量由高至低排列，佔比 &ge; {threshold}% 判定為重大排放源
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-5 py-3 text-center font-medium w-16">排名</th>
                <th className="px-5 py-3 text-left font-medium">排放源</th>
                <th className="px-5 py-3 text-left font-medium">據點</th>
                <th className="px-5 py-3 text-left font-medium">範疇</th>
                <th className="px-5 py-3 text-left font-medium">類別</th>
                <th className="px-5 py-3 text-right font-medium">
                  年排放量 (tCO2e)
                </th>
                <th className="px-5 py-3 text-right font-medium">佔比 (%)</th>
                <th className="px-5 py-3 text-right font-medium">
                  累積佔比 (%)
                </th>
                <th className="px-5 py-3 text-center font-medium">數據品質</th>
                <th className="px-5 py-3 text-center font-medium">重大性</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr
                  key={r.sourceId}
                  className={cn(
                    "border-b last:border-b-0 transition-colors",
                    r.isSignificant
                      ? "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                      : "hover:bg-muted/20"
                  )}
                >
                  <td className="px-5 py-2.5 text-center font-mono text-muted-foreground">
                    {r.rank}
                  </td>
                  <td className="px-5 py-2.5 font-medium">{r.sourceName}</td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {r.unitName}
                  </td>
                  <td className="px-5 py-2.5">
                    <Badge variant="outline" className="text-xs">
                      範疇{r.sourceScope}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {CATEGORY_LABELS[r.sourceCategory] ?? r.sourceCategory}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {fmt(r.totalEmission)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {r.percentage.toFixed(2)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {r.cumulativePercentage.toFixed(2)}
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        QUALITY_COLORS[r.dominantQuality]
                      )}
                    >
                      {DATA_QUALITY_LABELS[r.dominantQuality] ?? r.dominantQuality}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    {r.isSignificant ? (
                      <Badge className="bg-red-600 text-white hover:bg-red-700">
                        重大
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Grand total */}
              <tr className="border-t-2 bg-muted/40">
                <td colSpan={5} className="px-5 py-3 text-right font-semibold">
                  總計
                </td>
                <td className="px-5 py-3 text-right font-mono text-base font-bold">
                  {fmt(grandTotal)}
                </td>
                <td className="px-5 py-3 text-right font-mono font-semibold">
                  100.00
                </td>
                <td className="px-5 py-3 text-right font-mono font-semibold">
                  100.00
                </td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 2: Uncertainty Analysis (不確定性分析)
// ===========================================================================

function UncertaintyTab({
  sources,
  grandTotal,
  data,
  uncertaintyRows,
  scopeUncertainty,
  overallUncertainty,
}: {
  sources: AggregatedSource[];
  grandTotal: number;
  data: ActivityRecord[];
  uncertaintyRows: UncertaintyRow[];
  scopeUncertainty: ScopeUncertainty[];
  overallUncertainty: number;
}) {
  const [showMethodology, setShowMethodology] = useState(false);

  // Data quality distribution
  const qualityDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      PRIMARY: 0,
      SECONDARY: 0,
      ESTIMATED: 0,
    };
    for (const d of data) {
      counts[d.dataQuality] = (counts[d.dataQuality] ?? 0) + 1;
    }
    const total = data.length;
    return Object.entries(counts).map(([key, count]) => ({
      key,
      label: DATA_QUALITY_LABELS[key] ?? key,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }, [data]);

  // Sensitivity analysis (top 5)
  const sensitivityTop5 = useMemo(() => {
    return [...uncertaintyRows]
      .sort((a, b) => b.sensitivityIndex - a.sensitivityIndex)
      .slice(0, 5);
  }, [uncertaintyRows]);

  // Factor source distribution
  const factorSourceDist = useMemo(() => {
    const counts = new Map<string, number>();
    for (const src of sources) {
      for (const fs of src.factorSources) {
        counts.set(fs, (counts.get(fs) ?? 0) + 1);
      }
    }
    const total = [...counts.values()].reduce((s, v) => s + v, 0);
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        label: FACTOR_SOURCE_LABELS[key] ?? key,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [sources]);

  const factorSourceColors: Record<string, string> = {
    EPA_TW: "bg-blue-500",
    IPCC_AR6: "bg-emerald-500",
    GHG_PROTOCOL: "bg-purple-500",
    DEFRA: "bg-amber-500",
    CUSTOM: "bg-red-500",
  };

  // Sorted by combined uncertainty for error bar chart
  const sortedByUncertainty = useMemo(() => {
    return [...uncertaintyRows].sort((a, b) => b.combined - a.combined);
  }, [uncertaintyRows]);

  return (
    <div className="space-y-4">
      {/* Scope-level uncertainty cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {scopeUncertainty.map((su) => (
          <div key={su.scope} className="rounded-xl border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">
              範疇{su.scope} 綜合不確定性
            </p>
            <p className="mt-2 text-2xl font-bold">
              {su.total > 0 ? `\u00B1${su.combined.toFixed(1)}%` : "--"}
            </p>
            {su.total > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {fmt(su.lower, 2)} ~ {fmt(su.upper, 2)} tCO2e
              </p>
            )}
          </div>
        ))}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium text-muted-foreground">
            整體綜合不確定性
          </p>
          <p className="mt-2 text-2xl font-bold">
            {grandTotal > 0 ? `\u00B1${overallUncertainty.toFixed(1)}%` : "--"}
          </p>
          {grandTotal > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {fmt(grandTotal * (1 - overallUncertainty / 100), 2)} ~{" "}
              {fmt(grandTotal * (1 + overallUncertainty / 100), 2)} tCO2e
            </p>
          )}
        </div>
      </div>

      {/* Data quality distribution */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">活動數據品質分布</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          各品質等級的資料筆數與佔比
        </p>

        {/* Stacked bar */}
        <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg bg-muted">
          {qualityDistribution
            .filter((q) => q.count > 0)
            .map((q) => (
              <div
                key={q.key}
                className={cn(
                  "flex items-center justify-center text-xs font-medium text-white",
                  QUALITY_BAR_COLORS[q.key]
                )}
                style={{ width: `${q.percentage}%` }}
                title={`${q.label}: ${q.count} 筆 (${q.percentage.toFixed(1)}%)`}
              >
                {q.percentage >= 10
                  ? `${q.label} ${q.percentage.toFixed(0)}%`
                  : ""}
              </div>
            ))}
        </div>

        {/* Legend */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {qualityDistribution.map((q) => (
            <div
              key={q.key}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-3 w-3 rounded",
                    QUALITY_BAR_COLORS[q.key]
                  )}
                />
                <span className="text-sm">{q.label}</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-semibold">
                  {q.count}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({q.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uncertainty range visualization (error bar chart) */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">不確定性範圍圖</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          各排放源的排放量不確定性範圍，依綜合不確定性由高至低排列
        </p>
        <div className="mt-4 space-y-2">
          {sortedByUncertainty.map((r) => {
            const maxUpper = sortedByUncertainty[0]
              ? sortedByUncertainty.reduce(
                  (max, row) => Math.max(max, row.upperBound),
                  0
                )
              : 1;
            const scale = maxUpper > 0 ? 100 / maxUpper : 1;
            const leftPos = Math.max(r.lowerBound * scale, 0);
            const centerPos = r.totalEmission * scale;
            const rightPos = r.upperBound * scale;
            const barLeft = leftPos;
            const barWidth = Math.max(rightPos - leftPos, 0.5);

            const uncertaintyColor =
              r.combined > 20
                ? "bg-red-500"
                : r.combined > 10
                  ? "bg-amber-500"
                  : "bg-emerald-500";

            const uncertaintyTextColor =
              r.combined > 20
                ? "text-red-600 dark:text-red-400"
                : r.combined > 10
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400";

            return (
              <div key={r.sourceId} className="flex items-center gap-3">
                <div className="w-28 shrink-0 truncate text-xs font-medium text-right" title={r.sourceName}>
                  {r.sourceName}
                </div>
                <div className="flex-1 relative h-5">
                  {/* Error bar */}
                  <div
                    className={cn("absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full opacity-40", uncertaintyColor)}
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidth}%`,
                    }}
                  />
                  {/* Center point */}
                  <div
                    className={cn("absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-white shadow-sm", uncertaintyColor)}
                    style={{
                      left: `${centerPos}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  {/* Whisker lines */}
                  <div
                    className={cn("absolute top-1/2 -translate-y-1/2 h-3 w-px", uncertaintyColor)}
                    style={{ left: `${barLeft}%` }}
                  />
                  <div
                    className={cn("absolute top-1/2 -translate-y-1/2 h-3 w-px", uncertaintyColor)}
                    style={{ left: `${Math.min(barLeft + barWidth, 100)}%` }}
                  />
                </div>
                <span className={cn("w-16 text-right text-xs font-mono font-semibold", uncertaintyTextColor)}>
                  &plusmn;{r.combined.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
        {/* Color legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            &lt;10%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
            10-20%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            &gt;20%
          </span>
        </div>
      </div>

      {/* Sensitivity analysis */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">敏感度分析</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          敏感度指數 = (排放源佔比) x (綜合不確定性)，值越高代表對整體不確定性的影響越大
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sensitivityTop5.map((r, idx) => {
            const impactLevel =
              r.sensitivityIndex > 5
                ? { label: "高影響", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" }
                : r.sensitivityIndex > 2
                  ? { label: "中影響", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" }
                  : { label: "低影響", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
            return (
              <div key={r.sourceId} className={cn("rounded-lg border p-4", impactLevel.bg)}>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium truncate">{r.sourceName}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">敏感度指數</span>
                    <p className={cn("font-mono font-bold text-base", impactLevel.color)}>
                      {r.sensitivityIndex.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">影響評估</span>
                    <p className={cn("font-semibold", impactLevel.color)}>
                      {impactLevel.label}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">排放佔比</span>
                    <p className="font-mono">
                      {((r.totalEmission / grandTotal) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">綜合不確定性</span>
                    <p className="font-mono">&plusmn;{r.combined.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Factor source distribution */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">排放係數來源分布</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          各排放源使用之排放係數來源統計
        </p>
        {/* Horizontal stacked bar */}
        <div className="mt-4 flex h-8 w-full overflow-hidden rounded-lg bg-muted">
          {factorSourceDist.map((fs) => (
            <div
              key={fs.key}
              className={cn(
                "flex items-center justify-center text-xs font-medium text-white",
                factorSourceColors[fs.key] ?? "bg-gray-500"
              )}
              style={{ width: `${fs.percentage}%` }}
              title={`${fs.label}: ${fs.count} 個`}
            >
              {fs.percentage >= 12 ? `${fs.label}` : ""}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {factorSourceDist.map((fs) => (
            <div
              key={fs.key}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-3 w-3 rounded",
                    factorSourceColors[fs.key] ?? "bg-gray-500"
                  )}
                />
                <span className="text-xs">{fs.label}</span>
              </div>
              <span className="font-mono text-xs font-semibold">{fs.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Uncertainty detail table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-base font-semibold">各排放源不確定性明細</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            依據 IPCC 指引計算活動數據與排放係數的綜合不確定性
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-5 py-3 text-left font-medium">排放源</th>
                <th className="px-5 py-3 text-center font-medium">
                  活動數據品質
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  活動數據不確定性
                </th>
                <th className="px-5 py-3 text-left font-medium">
                  排放係數來源
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  係數不確定性
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  綜合不確定性
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  排放量範圍 (tCO2e)
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedByUncertainty.map((r) => (
                <tr
                  key={r.sourceId}
                  className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{r.sourceName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.unitName}
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        QUALITY_COLORS[r.dominantQuality]
                      )}
                    >
                      {DATA_QUALITY_LABELS[r.dominantQuality] ??
                        r.dominantQuality}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    &plusmn;{r.actUncertainty}%
                  </td>
                  <td className="px-5 py-2.5">
                    {FACTOR_SOURCE_LABELS[r.dominantFactorSource] ??
                      r.dominantFactorSource}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    &plusmn;{r.factUncertainty}%
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        r.combined > 20
                          ? "text-red-600 dark:text-red-400"
                          : r.combined > 12
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      &plusmn;{r.combined.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {fmt(r.lowerBound)} ~ {fmt(r.upperBound)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology explanation (expandable) */}
      <div className="rounded-xl border bg-card p-5">
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 text-blue-500 shrink-0" />
            <div className="text-left">
              <h3 className="text-sm font-semibold">不確定性計算方法</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                依據 IPCC 指引之誤差傳播法計算
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              showMethodology && "rotate-180"
            )}
          />
        </button>
        {showMethodology && (
          <div className="mt-4 space-y-4 text-sm">
            {/* Formula */}
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="font-semibold">IPCC 誤差傳播公式</p>
              <p className="mt-2 font-mono text-xs leading-relaxed">
                U_combined = sqrt( U_activity^2 + U_factor^2 )
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                其中 U_activity 為活動數據不確定性，U_factor 為排放係數不確定性。
                各排放源之綜合不確定性以加權均方根法（weighted root-sum-square）合併至範疇層級及整體層級。
              </p>
            </div>

            {/* Quality grade table */}
            <div>
              <p className="font-semibold mb-2">活動數據品質分級與不確定性</p>
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border px-3 py-2 text-left">品質等級</th>
                    <th className="border px-3 py-2 text-left">說明</th>
                    <th className="border px-3 py-2 text-right">不確定性</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-3 py-2">
                      <Badge variant="secondary" className={cn("text-xs", QUALITY_COLORS.PRIMARY)}>實測值</Badge>
                    </td>
                    <td className="border px-3 py-2 text-xs">直接量測取得之數據（如流量計、電表讀數）</td>
                    <td className="border px-3 py-2 text-right font-mono">&plusmn;5%</td>
                  </tr>
                  <tr>
                    <td className="border px-3 py-2">
                      <Badge variant="secondary" className={cn("text-xs", QUALITY_COLORS.SECONDARY)}>次級數據</Badge>
                    </td>
                    <td className="border px-3 py-2 text-xs">發票、帳單或供應商提供之數據</td>
                    <td className="border px-3 py-2 text-right font-mono">&plusmn;15%</td>
                  </tr>
                  <tr>
                    <td className="border px-3 py-2">
                      <Badge variant="secondary" className={cn("text-xs", QUALITY_COLORS.ESTIMATED)}>估算值</Badge>
                    </td>
                    <td className="border px-3 py-2 text-xs">基於假設或推估之數據</td>
                    <td className="border px-3 py-2 text-right font-mono">&plusmn;30%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Factor uncertainty table */}
            <div>
              <p className="font-semibold mb-2">排放係數來源與不確定性</p>
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border px-3 py-2 text-left">來源</th>
                    <th className="border px-3 py-2 text-left">說明</th>
                    <th className="border px-3 py-2 text-right">不確定性</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(FACTOR_SOURCE_LABELS).map(([key, label]) => (
                    <tr key={key}>
                      <td className="border px-3 py-2 font-medium">{label}</td>
                      <td className="border px-3 py-2 text-xs text-muted-foreground">
                        {key === "EPA_TW" && "台灣環境部公告排放係數"}
                        {key === "IPCC_AR6" && "IPCC 第六次評估報告預設值"}
                        {key === "GHG_PROTOCOL" && "GHG Protocol 提供之係數"}
                        {key === "DEFRA" && "英國 DEFRA 公布之係數"}
                        {key === "CUSTOM" && "自行建立或供應商提供之係數"}
                      </td>
                      <td className="border px-3 py-2 text-right font-mono">
                        &plusmn;{FACTOR_SOURCE_UNCERTAINTY[key]}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold">降低不確定性建議</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          根據目前數據品質狀況提出改善建議
        </p>
        <div className="mt-4 space-y-3">
          <RecommendationList data={data} sources={sources} />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 3: Data Quality Assessment (數據品質評估)
// ===========================================================================

function QualityTab({
  sources,
  grandTotal,
  data,
  uncertaintyRows,
}: {
  sources: AggregatedSource[];
  grandTotal: number;
  data: ActivityRecord[];
  uncertaintyRows: UncertaintyRow[];
}) {
  // Overall quality score (weighted by emission amount)
  const overallQualityScore = useMemo(() => {
    let totalWeight = 0;
    let weightedScore = 0;
    for (const src of sources) {
      const score = DATA_QUALITY_SCORE[src.dominantQuality] ?? 30;
      weightedScore += score * src.totalEmission;
      totalWeight += src.totalEmission;
    }
    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }, [sources]);

  // Quality by scope
  const qualityByScope = useMemo(() => {
    return [1, 2].map((scope) => {
      const scopeSources = sources.filter((s) => s.sourceScope === scope);
      const counts: Record<string, number> = { PRIMARY: 0, SECONDARY: 0, ESTIMATED: 0 };
      for (const src of scopeSources) {
        counts[src.dominantQuality] = (counts[src.dominantQuality] ?? 0) + 1;
      }
      const total = scopeSources.length;
      return {
        scope,
        total,
        distribution: Object.entries(counts).map(([key, count]) => ({
          key,
          label: DATA_QUALITY_LABELS[key] ?? key,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        })),
      };
    }).filter((s) => s.total > 0);
  }, [sources]);

  // Quality by month heatmap data
  const monthlyQualityMap = useMemo(() => {
    // Build a map: sourceId -> month -> quality
    const map = new Map<string, Map<number, string>>();
    for (const d of data) {
      if (!map.has(d.sourceId)) {
        map.set(d.sourceId, new Map());
      }
      map.get(d.sourceId)!.set(d.month, d.dataQuality);
    }
    return map;
  }, [data]);

  // Quality trend by month
  const monthlyQualityTrend = useMemo(() => {
    const monthCounts: { month: number; primary: number; secondary: number; estimated: number; total: number; score: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      let primary = 0, secondary = 0, estimated = 0;
      for (const d of data) {
        if (d.month === m) {
          if (d.dataQuality === "PRIMARY") primary++;
          else if (d.dataQuality === "SECONDARY") secondary++;
          else estimated++;
        }
      }
      const total = primary + secondary + estimated;
      const score = total > 0
        ? (primary * 100 + secondary * 60 + estimated * 30) / total
        : 0;
      monthCounts.push({ month: m, primary, secondary, estimated, total, score });
    }
    return monthCounts.filter((m) => m.total > 0);
  }, [data]);

  // Missing data detection
  const missingDataSources = useMemo(() => {
    return sources
      .map((src) => {
        const months = monthlyQualityMap.get(src.sourceId);
        const coveredMonths = months ? months.size : 0;
        const missingMonths: number[] = [];
        for (let m = 1; m <= 12; m++) {
          if (!months?.has(m)) missingMonths.push(m);
        }
        return {
          ...src,
          coveredMonths,
          missingMonths,
          completeness: (coveredMonths / 12) * 100,
        };
      })
      .filter((s) => s.missingMonths.length > 0)
      .sort((a, b) => a.completeness - b.completeness);
  }, [sources, monthlyQualityMap]);

  // Quality improvement roadmap
  const improvementRoadmap = useMemo(() => {
    const items: { priority: number; source: string; action: string; impact: string; potentialReduction: number }[] = [];

    // Sources using estimated data with high emissions
    for (const row of uncertaintyRows) {
      if (row.dominantQuality === "ESTIMATED") {
        const pctOfTotal = grandTotal > 0 ? (row.totalEmission / grandTotal) * 100 : 0;
        const currentU = row.combined;
        // If upgraded to SECONDARY
        const newActU = DATA_QUALITY_UNCERTAINTY.SECONDARY;
        const newCombined = Math.sqrt(newActU ** 2 + row.factUncertainty ** 2);
        const reduction = currentU - newCombined;
        items.push({
          priority: pctOfTotal * reduction,
          source: row.sourceName,
          action: `將「${row.sourceName}」數據品質從估算值提升為次級數據`,
          impact: `不確定性可從 \u00B1${currentU.toFixed(1)}% 降至 \u00B1${newCombined.toFixed(1)}%`,
          potentialReduction: reduction,
        });
      } else if (row.dominantQuality === "SECONDARY") {
        const pctOfTotal = grandTotal > 0 ? (row.totalEmission / grandTotal) * 100 : 0;
        const currentU = row.combined;
        const newActU = DATA_QUALITY_UNCERTAINTY.PRIMARY;
        const newCombined = Math.sqrt(newActU ** 2 + row.factUncertainty ** 2);
        const reduction = currentU - newCombined;
        items.push({
          priority: pctOfTotal * reduction,
          source: row.sourceName,
          action: `將「${row.sourceName}」數據品質從次級數據提升為實測值`,
          impact: `不確定性可從 \u00B1${currentU.toFixed(1)}% 降至 \u00B1${newCombined.toFixed(1)}%`,
          potentialReduction: reduction,
        });
      }
      // Custom factor source
      if (row.dominantFactorSource === "CUSTOM") {
        const currentU = row.combined;
        const newFactU = FACTOR_SOURCE_UNCERTAINTY.EPA_TW;
        const newCombined = Math.sqrt(row.actUncertainty ** 2 + newFactU ** 2);
        const reduction = currentU - newCombined;
        const pctOfTotal = grandTotal > 0 ? (row.totalEmission / grandTotal) * 100 : 0;
        items.push({
          priority: pctOfTotal * reduction,
          source: row.sourceName,
          action: `將「${row.sourceName}」排放係數改用環境部公告係數`,
          impact: `不確定性可從 \u00B1${currentU.toFixed(1)}% 降至 \u00B1${newCombined.toFixed(1)}%`,
          potentialReduction: reduction,
        });
      }
    }

    return items.sort((a, b) => b.priority - a.priority).slice(0, 8);
  }, [uncertaintyRows, grandTotal]);

  // Gauge rendering helper
  const gaugeColor =
    overallQualityScore >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : overallQualityScore >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
  const gaugeBg =
    overallQualityScore >= 80
      ? "bg-emerald-500"
      : overallQualityScore >= 50
        ? "bg-amber-500"
        : "bg-red-500";
  const gaugeLabel =
    overallQualityScore >= 80
      ? "優良"
      : overallQualityScore >= 50
        ? "普通"
        : "待改善";

  const heatmapCellColor = (quality: string | undefined) => {
    if (!quality) return "bg-gray-100 dark:bg-gray-800";
    if (quality === "PRIMARY") return "bg-emerald-400 dark:bg-emerald-600";
    if (quality === "SECONDARY") return "bg-amber-400 dark:bg-amber-600";
    return "bg-red-400 dark:bg-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Overall quality score gauge */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">整體數據品質評分</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          以排放量加權計算之綜合品質分數（實測值=100, 次級數據=60, 估算值=30）
        </p>
        <div className="mt-4 flex items-center gap-6">
          {/* Gauge meter */}
          <div className="relative flex flex-col items-center">
            <div className="relative h-28 w-28">
              {/* Background arc */}
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50" cy="50" r="40"
                  fill="none" stroke="currentColor"
                  className="text-muted/30"
                  strokeWidth="8"
                  strokeDasharray={`${Math.PI * 80}`}
                  strokeDashoffset={`${Math.PI * 80 * 0.25}`}
                  strokeLinecap="round"
                />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none" stroke="currentColor"
                  className={gaugeColor}
                  strokeWidth="8"
                  strokeDasharray={`${Math.PI * 80}`}
                  strokeDashoffset={`${Math.PI * 80 * (1 - (overallQualityScore / 100) * 0.75)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-2xl font-bold", gaugeColor)}>
                  {overallQualityScore.toFixed(0)}
                </span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>
            <span className={cn("mt-1 text-sm font-semibold", gaugeColor)}>
              {gaugeLabel}
            </span>
          </div>

          {/* Score breakdown */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground">優良</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "100%" }} />
              </div>
              <span className="w-12 text-right text-xs font-mono">80-100</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground">普通</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "60%" }} />
              </div>
              <span className="w-12 text-right text-xs font-mono">50-79</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-muted-foreground">待改善</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "30%" }} />
              </div>
              <span className="w-12 text-right text-xs font-mono">0-49</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quality by scope */}
      <div className="grid gap-4 sm:grid-cols-2">
        {qualityByScope.map((sq) => (
          <div key={sq.scope} className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">
              {SCOPE_LABELS[sq.scope] ?? `範疇${sq.scope}`} 品質分布
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sq.total} 個排放源
            </p>
            <div className="mt-3 flex h-6 w-full overflow-hidden rounded-lg bg-muted">
              {sq.distribution
                .filter((d) => d.count > 0)
                .map((d) => (
                  <div
                    key={d.key}
                    className={cn(
                      "flex items-center justify-center text-[10px] font-medium text-white",
                      QUALITY_BAR_COLORS[d.key]
                    )}
                    style={{ width: `${d.percentage}%` }}
                    title={`${d.label}: ${d.count} 個`}
                  >
                    {d.percentage >= 15 ? `${d.count}` : ""}
                  </div>
                ))}
            </div>
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
              {sq.distribution.map((d) => (
                <span key={d.key} className="flex items-center gap-1">
                  <span className={cn("inline-block h-2 w-2 rounded", QUALITY_BAR_COLORS[d.key])} />
                  {d.label}: {d.count}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly quality heatmap */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">月度數據品質熱圖</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          行為排放源，列為月份，顏色表示數據品質等級（空白表示無數據）
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left font-medium w-36">排放源</th>
                {MONTH_LABELS.map((m, idx) => (
                  <th key={idx} className="px-1 py-1.5 text-center font-medium w-10">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.slice(0, 15).map((src) => {
                const monthMap = monthlyQualityMap.get(src.sourceId);
                return (
                  <tr key={src.sourceId} className="border-t">
                    <td className="px-2 py-1 truncate font-medium" title={src.sourceName}>
                      {src.sourceName}
                    </td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const quality = monthMap?.get(m);
                      return (
                        <td key={m} className="px-1 py-1 text-center">
                          <div
                            className={cn(
                              "mx-auto h-4 w-full rounded-sm",
                              heatmapCellColor(quality)
                            )}
                            title={quality ? DATA_QUALITY_LABELS[quality] : "無數據"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sources.length > 15 && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              僅顯示前 15 個排放源（共 {sources.length} 個）
            </p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-emerald-400 dark:bg-emerald-600" />
            實測值
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-amber-400 dark:bg-amber-600" />
            次級數據
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-400 dark:bg-red-600" />
            估算值
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-gray-100 dark:bg-gray-800" />
            無數據
          </span>
        </div>
      </div>

      {/* Quality trend by month */}
      {monthlyQualityTrend.length > 1 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">月度品質趨勢</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            各月份之品質評分變化趨勢
          </p>
          <div className="mt-4">
            {/* Simple bar chart showing monthly scores */}
            <div className="flex items-end gap-1 h-32">
              {monthlyQualityTrend.map((m) => {
                const barH = Math.max((m.score / 100) * 100, 2);
                const barColor =
                  m.score >= 80
                    ? "bg-emerald-500"
                    : m.score >= 50
                      ? "bg-amber-500"
                      : "bg-red-500";
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {m.score.toFixed(0)}
                    </span>
                    <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                      <div
                        className={cn("w-full max-w-8 rounded-t", barColor)}
                        style={{ height: `${barH}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {m.month}月
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Missing data detection */}
      {missingDataSources.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <h3 className="text-base font-semibold">數據缺漏偵測</h3>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              以下排放源的月度數據不完整（未滿 12 個月）
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-5 py-3 text-left font-medium">排放源</th>
                  <th className="px-5 py-3 text-left font-medium">據點</th>
                  <th className="px-5 py-3 text-right font-medium">已有月數</th>
                  <th className="px-5 py-3 text-right font-medium">完整度</th>
                  <th className="px-5 py-3 text-left font-medium">缺漏月份</th>
                </tr>
              </thead>
              <tbody>
                {missingDataSources.map((src) => (
                  <tr key={src.sourceId} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-5 py-2.5 font-medium">{src.sourceName}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{src.unitName}</td>
                    <td className="px-5 py-2.5 text-right font-mono">
                      {src.coveredMonths} / 12
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              src.completeness >= 75
                                ? "bg-emerald-500"
                                : src.completeness >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${src.completeness}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs">
                          {src.completeness.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {src.missingMonths.map((m) => (
                          <Badge key={m} variant="outline" className="text-xs text-red-600 dark:text-red-400 border-red-300 dark:border-red-800">
                            {m}月
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quality improvement roadmap */}
      {improvementRoadmap.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-base font-semibold">品質改善路徑</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            依潛在影響排序之數據品質改善建議
          </p>
          <div className="mt-4 space-y-3">
            {improvementRoadmap.map((item, idx) => (
              <div key={idx} className="flex gap-3 rounded-lg border p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.impact}（不確定性降幅: {item.potentialReduction.toFixed(1)} 百分點）
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Tab 4: Analysis Report (分析報告)
// ===========================================================================

function ReportTab({
  sources,
  grandTotal,
  data,
  threshold,
  uncertaintyRows,
  scopeUncertainty,
  overallUncertainty,
  periodName,
  periodYear,
}: {
  sources: AggregatedSource[];
  grandTotal: number;
  data: ActivityRecord[];
  threshold: number;
  uncertaintyRows: UncertaintyRow[];
  scopeUncertainty: ScopeUncertainty[];
  overallUncertainty: number;
  periodName: string;
  periodYear: number;
}) {
  // Ranked sources for materiality
  const ranked = useMemo(() => {
    const sorted = [...sources].sort(
      (a, b) => b.totalEmission - a.totalEmission
    );
    let cumulative = 0;
    return sorted.map((src, idx) => {
      const pct = (src.totalEmission / grandTotal) * 100;
      cumulative += pct;
      return {
        ...src,
        rank: idx + 1,
        percentage: pct,
        cumulativePercentage: cumulative,
        isSignificant: pct >= threshold,
      };
    });
  }, [sources, grandTotal, threshold]);

  const significantCount = ranked.filter((r) => r.isSignificant).length;
  const significantTotal = ranked
    .filter((r) => r.isSignificant)
    .reduce((s, r) => s + r.totalEmission, 0);
  const significantPct =
    grandTotal > 0 ? (significantTotal / grandTotal) * 100 : 0;

  // Quality score
  const qualityScore = useMemo(() => {
    let totalWeight = 0;
    let weightedScore = 0;
    for (const src of sources) {
      const score = DATA_QUALITY_SCORE[src.dominantQuality] ?? 30;
      weightedScore += score * src.totalEmission;
      totalWeight += src.totalEmission;
    }
    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }, [sources]);

  // Scope emissions
  const scopeEmissions = useMemo(() => {
    return [1, 2].map((scope) => {
      const total = sources
        .filter((s) => s.sourceScope === scope)
        .reduce((s, src) => s + src.totalEmission, 0);
      return { scope, total, pct: grandTotal > 0 ? (total / grandTotal) * 100 : 0 };
    }).filter((s) => s.total > 0);
  }, [sources, grandTotal]);

  // Uncertainty assessment text
  const uncertaintyAssessment =
    overallUncertainty <= 10
      ? "整體不確定性水準良好，數據可信度高"
      : overallUncertainty <= 20
        ? "整體不確定性水準尚可，建議持續改善數據品質"
        : "整體不確定性偏高，建議優先改善估算值數據";

  const qualityAssessment =
    qualityScore >= 80
      ? "數據品質優良，大部分排放源採用實測值"
      : qualityScore >= 50
        ? "數據品質普通，建議逐步提升至實測值"
        : "數據品質待改善，估算值佔比偏高";

  // Recommendations (merged)
  const mergedRecommendations = useMemo(() => {
    const items: { priority: string; text: string }[] = [];

    const estimatedCount = data.filter((d) => d.dataQuality === "ESTIMATED").length;
    const estimatedPct = data.length > 0 ? (estimatedCount / data.length) * 100 : 0;
    if (estimatedPct > 20) {
      items.push({ priority: "high", text: `估算值佔比偏高 (${estimatedPct.toFixed(0)}%)，建議優先將重大排放源之估算值改為實測值或次級數據` });
    }

    const customFactorSources = sources.filter((s) => s.dominantFactorSource === "CUSTOM");
    if (customFactorSources.length > 0) {
      items.push({ priority: "high", text: `${customFactorSources.length} 個排放源使用自訂排放係數，建議改用環境部或 IPCC 公告係數` });
    }

    // Missing data
    const incompleteSources = sources.filter((s) => s.monthsWithData.length < 12);
    if (incompleteSources.length > 0) {
      items.push({ priority: "medium", text: `${incompleteSources.length} 個排放源的月度數據不完整，建議補齊缺漏月份` });
    }

    if (overallUncertainty > 15) {
      items.push({ priority: "medium", text: "整體不確定性偏高，建議針對敏感度指數最高的排放源優先改善數據品質" });
    }

    items.push({ priority: "low", text: "定期校驗計量設備，確保實測值準確性" });
    items.push({ priority: "low", text: "追蹤環境部及 IPCC 排放係數更新，確保使用最新版本" });

    return items;
  }, [data, sources, overallUncertainty]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    const BOM = "\uFEFF";
    const lines: string[] = [];

    lines.push("碳排放重大性與不確定性分析報告");
    lines.push(`盤查期間,${periodName} (${periodYear})`);
    lines.push(`匯出時間,${new Date().toLocaleString("zh-TW")}`);
    lines.push("");

    // Executive summary
    lines.push("一、摘要");
    lines.push(`總排放量 (tCO2e),${grandTotal.toFixed(4)}`);
    scopeEmissions.forEach((se) => {
      lines.push(`範疇${se.scope}排放量 (tCO2e),${se.total.toFixed(4)},佔比,${se.pct.toFixed(1)}%`);
    });
    lines.push(`重大排放源數,${significantCount},佔總排放量,${significantPct.toFixed(1)}%`);
    lines.push(`整體不確定性,\u00B1${overallUncertainty.toFixed(1)}%`);
    lines.push(`數據品質評分,${qualityScore.toFixed(0)} / 100`);
    lines.push("");

    // Materiality
    lines.push("二、重大性分析明細");
    lines.push("排名,排放源,據點,範疇,類別,年排放量(tCO2e),佔比(%),累積佔比(%),數據品質,重大性");
    ranked.forEach((r) => {
      lines.push([
        r.rank,
        `"${r.sourceName}"`,
        `"${r.unitName}"`,
        `範疇${r.sourceScope}`,
        `"${CATEGORY_LABELS[r.sourceCategory] ?? r.sourceCategory}"`,
        r.totalEmission.toFixed(4),
        r.percentage.toFixed(2),
        r.cumulativePercentage.toFixed(2),
        DATA_QUALITY_LABELS[r.dominantQuality] ?? r.dominantQuality,
        r.isSignificant ? "重大" : "",
      ].join(","));
    });
    lines.push("");

    // Uncertainty
    lines.push("三、不確定性分析明細");
    lines.push("排放源,據點,活動數據品質,活動數據不確定性(%),排放係數來源,係數不確定性(%),綜合不確定性(%),排放下限(tCO2e),排放上限(tCO2e)");
    uncertaintyRows
      .sort((a, b) => b.combined - a.combined)
      .forEach((r) => {
        lines.push([
          `"${r.sourceName}"`,
          `"${r.unitName}"`,
          DATA_QUALITY_LABELS[r.dominantQuality] ?? r.dominantQuality,
          r.actUncertainty,
          FACTOR_SOURCE_LABELS[r.dominantFactorSource] ?? r.dominantFactorSource,
          r.factUncertainty,
          r.combined.toFixed(1),
          r.lowerBound.toFixed(4),
          r.upperBound.toFixed(4),
        ].join(","));
      });
    lines.push("");

    // Recommendations
    lines.push("四、改善建議");
    mergedRecommendations.forEach((rec, idx) => {
      lines.push(`${idx + 1},${rec.priority === "high" ? "高" : rec.priority === "medium" ? "中" : "低"},"${rec.text}"`);
    });

    const csvContent = BOM + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `碳排分析報告_${periodYear}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [
    grandTotal,
    scopeEmissions,
    significantCount,
    significantPct,
    overallUncertainty,
    qualityScore,
    ranked,
    uncertaintyRows,
    mergedRecommendations,
    periodName,
    periodYear,
  ]);

  const priorityConfig: Record<string, { label: string; color: string }> = {
    high: { label: "高", color: "text-red-600 dark:text-red-400" },
    medium: { label: "中", color: "text-amber-600 dark:text-amber-400" },
    low: { label: "低", color: "text-blue-600 dark:text-blue-400" },
  };

  return (
    <div className="space-y-4">
      {/* Executive summary */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold">執行摘要</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {periodName} ({periodYear}) 碳盤查分析結果總覽
        </p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p>
            本期盤查共識別 <strong>{sources.length}</strong> 個排放源，
            總排放量為 <strong>{fmt(grandTotal, 2)} tCO2e</strong>。
            {scopeEmissions.map((se) => (
              <span key={se.scope}>
                {SCOPE_LABELS[se.scope]}排放量為 {fmt(se.total, 2)} tCO2e（佔 {se.pct.toFixed(1)}%）；
              </span>
            ))}
          </p>
          <p>
            依 {threshold}% 門檻判定，共有 <strong>{significantCount}</strong> 個重大排放源，
            合計佔總排放量 <strong>{significantPct.toFixed(1)}%</strong>。
          </p>
          <p>
            整體不確定性為 <strong>&plusmn;{overallUncertainty.toFixed(1)}%</strong>，
            {uncertaintyAssessment}。
          </p>
          <p>
            數據品質加權評分為 <strong>{qualityScore.toFixed(0)}</strong> 分（滿分 100），
            {qualityAssessment}。
          </p>
        </div>
      </div>

      {/* Key findings cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <h4 className="text-sm font-semibold">總排放量</h4>
          </div>
          <p className="mt-2 text-xl font-bold">{fmt(grandTotal, 2)}</p>
          <p className="text-xs text-muted-foreground">tCO2e</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-red-500" />
            <h4 className="text-sm font-semibold">重大排放源</h4>
          </div>
          <p className="mt-2 text-xl font-bold">
            {significantCount} / {sources.length}
          </p>
          <p className="text-xs text-muted-foreground">
            佔總排放 {significantPct.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" />
            <h4 className="text-sm font-semibold">不確定性</h4>
          </div>
          <p className="mt-2 text-xl font-bold">
            &plusmn;{overallUncertainty.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">
            {overallUncertainty <= 10 ? "良好" : overallUncertainty <= 20 ? "尚可" : "偏高"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" />
            <h4 className="text-sm font-semibold">品質評分</h4>
          </div>
          <p className="mt-2 text-xl font-bold">{qualityScore.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">
            / 100（{qualityScore >= 80 ? "優良" : qualityScore >= 50 ? "普通" : "待改善"}）
          </p>
        </div>
      </div>

      {/* Materiality summary table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-base font-semibold">重大性分析摘要</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-5 py-3 text-center font-medium w-12">排名</th>
                <th className="px-5 py-3 text-left font-medium">排放源</th>
                <th className="px-5 py-3 text-left font-medium">範疇</th>
                <th className="px-5 py-3 text-right font-medium">排放量 (tCO2e)</th>
                <th className="px-5 py-3 text-right font-medium">佔比 (%)</th>
                <th className="px-5 py-3 text-center font-medium">重大性</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 10).map((r) => (
                <tr
                  key={r.sourceId}
                  className={cn(
                    "border-b last:border-b-0 transition-colors",
                    r.isSignificant
                      ? "bg-red-50/60 dark:bg-red-950/20"
                      : ""
                  )}
                >
                  <td className="px-5 py-2 text-center font-mono text-muted-foreground">{r.rank}</td>
                  <td className="px-5 py-2 font-medium">{r.sourceName}</td>
                  <td className="px-5 py-2">
                    <Badge variant="outline" className="text-xs">範疇{r.sourceScope}</Badge>
                  </td>
                  <td className="px-5 py-2 text-right font-mono">{fmt(r.totalEmission)}</td>
                  <td className="px-5 py-2 text-right font-mono">{r.percentage.toFixed(2)}</td>
                  <td className="px-5 py-2 text-center">
                    {r.isSignificant ? (
                      <Badge className="bg-red-600 text-white hover:bg-red-700">重大</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </td>
                </tr>
              ))}
              {ranked.length > 10 && (
                <tr className="bg-muted/30">
                  <td colSpan={6} className="px-5 py-2 text-center text-xs text-muted-foreground">
                    ...及其餘 {ranked.length - 10} 個排放源
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Uncertainty summary table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-base font-semibold">不確定性分析摘要</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-5 py-3 text-left font-medium">層級</th>
                <th className="px-5 py-3 text-right font-medium">排放量 (tCO2e)</th>
                <th className="px-5 py-3 text-right font-medium">綜合不確定性</th>
                <th className="px-5 py-3 text-right font-medium">排放量下限</th>
                <th className="px-5 py-3 text-right font-medium">排放量上限</th>
              </tr>
            </thead>
            <tbody>
              {scopeUncertainty
                .filter((su) => su.total > 0)
                .map((su) => (
                  <tr key={su.scope} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5 font-medium">範疇{su.scope}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmt(su.total)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">&plusmn;{su.combined.toFixed(1)}%</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmt(su.lower)}</td>
                    <td className="px-5 py-2.5 text-right font-mono">{fmt(su.upper)}</td>
                  </tr>
                ))}
              <tr className="border-t-2 bg-muted/40">
                <td className="px-5 py-2.5 font-semibold">整體</td>
                <td className="px-5 py-2.5 text-right font-mono font-bold">{fmt(grandTotal)}</td>
                <td className="px-5 py-2.5 text-right font-mono font-bold">&plusmn;{overallUncertainty.toFixed(1)}%</td>
                <td className="px-5 py-2.5 text-right font-mono">
                  {fmt(grandTotal * (1 - overallUncertainty / 100))}
                </td>
                <td className="px-5 py-2.5 text-right font-mono">
                  {fmt(grandTotal * (1 + overallUncertainty / 100))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold">綜合改善建議</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          彙整重大性、不確定性及數據品質分析結果提出之優先改善建議
        </p>
        <div className="mt-4 space-y-3">
          {mergedRecommendations.map((rec, idx) => {
            const cfg = priorityConfig[rec.priority];
            return (
              <div key={idx} className="flex gap-3 rounded-lg border p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {idx + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", cfg?.color)}
                    >
                      優先級: {cfg?.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">{rec.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Download className="h-4 w-4" />
          匯出分析報告 CSV
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recommendations sub-component
// ---------------------------------------------------------------------------

function RecommendationList({
  data,
  sources,
}: {
  data: ActivityRecord[];
  sources: AggregatedSource[];
}) {
  const recommendations = useMemo(() => {
    const items: { priority: string; text: string; detail: string }[] = [];

    const estimatedCount = data.filter(
      (d) => d.dataQuality === "ESTIMATED"
    ).length;
    const estimatedPct =
      data.length > 0 ? (estimatedCount / data.length) * 100 : 0;

    if (estimatedPct > 20) {
      items.push({
        priority: "high",
        text: `估算值佔比偏高 (${estimatedPct.toFixed(0)}%)`,
        detail:
          "建議優先將估算值改為實測值或次級數據，可有效降低整體不確定性。安裝流量計、電表等計量設備，或取得供應商提供的發票數據。",
      });
    } else if (estimatedCount > 0) {
      items.push({
        priority: "medium",
        text: `仍有 ${estimatedCount} 筆估算值數據`,
        detail:
          "建議逐步替換為實測數據或次級數據來源，以提升數據品質。",
      });
    }

    const customFactorSources = sources.filter(
      (s) => s.dominantFactorSource === "CUSTOM"
    );
    if (customFactorSources.length > 0) {
      items.push({
        priority: "high",
        text: `${customFactorSources.length} 個排放源使用自訂排放係數`,
        detail:
          "自訂排放係數不確定性較高 (\u00B125%)。建議優先採用環境部公告係數或 IPCC AR6 預設值，以降低係數不確定性。",
      });
    }

    const secondaryCount = data.filter(
      (d) => d.dataQuality === "SECONDARY"
    ).length;
    if (secondaryCount > data.length * 0.5) {
      items.push({
        priority: "medium",
        text: "大部分數據為次級數據",
        detail:
          "建議針對重大排放源優先導入直接監測（如安裝連續排放監測系統 CEMS），將次級數據提升為實測值。",
      });
    }

    items.push({
      priority: "low",
      text: "定期校驗計量設備",
      detail:
        "確保流量計、電表等計量設備定期經過校正，並保留校正紀錄，以維持實測值的準確性與可追溯性。",
    });

    items.push({
      priority: "low",
      text: "追蹤排放係數更新",
      detail:
        "環境部與 IPCC 定期更新排放係數。建議每年確認使用最新版本係數，並記錄係數版本與來源。",
    });

    return items;
  }, [data, sources]);

  const priorityConfig: Record<
    string,
    { label: string; color: string; bg: string }
  > = {
    high: {
      label: "高",
      color: "text-red-700 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    },
    medium: {
      label: "中",
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    },
    low: {
      label: "低",
      color: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
  };

  return (
    <>
      {recommendations.map((rec, idx) => {
        const cfg = priorityConfig[rec.priority];
        return (
          <div
            key={idx}
            className="flex gap-3 rounded-lg border p-4"
          >
            <Badge
              variant="secondary"
              className={cn("h-fit shrink-0 text-xs", cfg.bg, cfg.color)}
            >
              優先級: {cfg.label}
            </Badge>
            <div>
              <p className="text-sm font-medium">{rec.text}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {rec.detail}
              </p>
            </div>
          </div>
        );
      })}
    </>
  );
}
