"use client";

import { useState, useCallback } from "react";
import { Flame, Zap, TrendingDown, CheckCircle, Download, ClipboardList, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  MonthlyEmissionsChart,
  CategoryPieChart,
  ScopePieChart,
} from "./report-charts";
import type { MonthlyData, CategoryData, ScopeData } from "./report-charts";

// ---------- Types ----------

interface RegisterRow {
  unitName: string;
  sourceName: string;
  scope: number;
  category: string;
  categoryLabel: string;
  annualActivity: number;
  activityUnit: string;
  factorValue: number;
  factorUnit: string;
  factorSource: string;
  co2: number;
  ch4: number;
  n2o: number;
  otherGhg: number;
  total: number;
}

interface MonthlyDetailRow {
  unitName: string;
  sourceName: string;
  scope: number;
  category: string;
  month: number;
  activityAmount: number;
  activityUnit: string;
  emissionAmount: number;
}

interface CategoryGroup {
  category: string;
  categoryLabel: string;
  rows: {
    sourceName: string;
    unitName: string;
    emission: number;
    percentage: number;
  }[];
  subtotal: number;
  subtotalPercentage: number;
}

interface GhgRow {
  name: string;
  amount: number;
}

export interface ReportsPageProps {
  orgName: string;
  orgTaxId: string;
  boundaryMethod: string;
  periodName: string;
  periodYear: number;
  // Existing report data
  monthlyData: MonthlyData[];
  categoryData: CategoryData[];
  scopeData: ScopeData[];
  approvalRate: number;
  approvedCount: number;
  totalCount: number;
  totalScope1: number;
  totalScope2: number;
  grandTotal: number;
  categoryGroups: CategoryGroup[];
  ghgRows: GhgRow[];
  ghgGrandTotal: number;
  hasData: boolean;
  // Inventory register
  registerData: RegisterRow[];
  // Monthly export
  monthlyDetail: MonthlyDetailRow[];
}

// ---------- CSV helpers ----------

const SCOPE_LABELS: Record<number, string> = {
  1: "範疇一（直接排放）",
  2: "範疇二（間接排放）",
  3: "範疇三（價值鏈排放）",
};

const BOUNDARY_LABELS: Record<string, string> = {
  OPERATIONAL_CONTROL: "營運控制法",
  FINANCIAL_CONTROL: "財務控制法",
  EQUITY_SHARE: "股權比例法",
};

function downloadCsv(filename: string, csvContent: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | number)[]): string {
  return fields.map(escapeCsvField).join(",");
}

// ---------- Tabs ----------

const TABS = [
  { id: "report", label: "排放報告", icon: BarChart3 },
  { id: "register", label: "盤查清冊", icon: ClipboardList },
  { id: "export", label: "匯出報告", icon: Download },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ---------- Main component ----------

export function ReportsPageClient(props: ReportsPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("report");

  const {
    orgName,
    orgTaxId,
    boundaryMethod,
    periodName,
    periodYear,
    monthlyData,
    categoryData,
    scopeData,
    approvalRate,
    approvedCount,
    totalCount,
    totalScope1,
    totalScope2,
    grandTotal,
    categoryGroups,
    ghgRows,
    ghgGrandTotal,
    hasData,
    registerData,
    monthlyDetail,
  } = props;

  // -- Export handlers --

  const exportRegisterCsv = useCallback(() => {
    const headers = [
      "序號",
      "據點",
      "排放源名稱",
      "範疇",
      "排放類別",
      "活動數據(年度合計)",
      "活動數據單位",
      "排放係數",
      "係數單位",
      "係數來源",
      "CO₂排放量(tCO₂e)",
      "CH₄排放量(tCO₂e)",
      "N₂O排放量(tCO₂e)",
      "其他GHG排放量(tCO₂e)",
      "合計排放量(tCO₂e)",
    ];

    const rows = registerData.map((r, i) =>
      toCsvRow([
        i + 1,
        r.unitName,
        r.sourceName,
        SCOPE_LABELS[r.scope] ?? `範疇${r.scope}`,
        r.categoryLabel,
        r.annualActivity.toFixed(4),
        r.activityUnit,
        r.factorValue.toFixed(6),
        r.factorUnit,
        r.factorSource,
        r.co2.toFixed(4),
        r.ch4.toFixed(4),
        r.n2o.toFixed(4),
        r.otherGhg.toFixed(4),
        r.total.toFixed(4),
      ])
    );

    const meta = [
      `# 組織名稱: ${orgName}`,
      `# 統一編號: ${orgTaxId}`,
      `# 邊界方法: ${BOUNDARY_LABELS[boundaryMethod] ?? boundaryMethod}`,
      `# 盤查期間: ${periodName} (${periodYear})`,
      "",
    ];

    const csv = [...meta, toCsvRow(headers), ...rows].join("\n");
    downloadCsv(`盤查清冊_${periodYear}.csv`, csv);
  }, [registerData, orgName, orgTaxId, boundaryMethod, periodName, periodYear]);

  const exportSummaryCsv = useCallback(() => {
    const headers = ["範疇", "排放類別", "排放量(tCO₂e)", "佔比(%)"];

    // Group registerData by scope then category
    const scopeMap = new Map<number, Map<string, { label: string; total: number }>>();
    for (const r of registerData) {
      if (!scopeMap.has(r.scope)) scopeMap.set(r.scope, new Map());
      const catMap = scopeMap.get(r.scope)!;
      if (!catMap.has(r.category)) catMap.set(r.category, { label: r.categoryLabel, total: 0 });
      catMap.get(r.category)!.total += r.total;
    }

    const rows: string[] = [];
    let runningTotal = 0;
    for (const r of registerData) runningTotal += r.total;

    for (const [scope, catMap] of Array.from(scopeMap.entries()).sort((a, b) => a[0] - b[0])) {
      let scopeTotal = 0;
      for (const [, data] of catMap) {
        const pct = runningTotal > 0 ? ((data.total / runningTotal) * 100).toFixed(2) : "0.00";
        rows.push(
          toCsvRow([
            SCOPE_LABELS[scope] ?? `範疇${scope}`,
            data.label,
            data.total.toFixed(4),
            pct,
          ])
        );
        scopeTotal += data.total;
      }
      const scopePct = runningTotal > 0 ? ((scopeTotal / runningTotal) * 100).toFixed(2) : "0.00";
      rows.push(toCsvRow([SCOPE_LABELS[scope] ?? `範疇${scope}`, "小計", scopeTotal.toFixed(4), scopePct]));
    }
    rows.push(toCsvRow(["總計", "", runningTotal.toFixed(4), "100.00"]));

    const csv = [toCsvRow(headers), ...rows].join("\n");
    downloadCsv(`排放摘要_${periodYear}.csv`, csv);
  }, [registerData, periodYear]);

  const exportMonthlyCsv = useCallback(() => {
    const headers = [
      "據點",
      "排放源名稱",
      "範疇",
      "排放類別",
      "月份",
      "活動數據量",
      "活動數據單位",
      "排放量(tCO₂e)",
    ];

    const rows = monthlyDetail.map((r) =>
      toCsvRow([
        r.unitName,
        r.sourceName,
        SCOPE_LABELS[r.scope] ?? `範疇${r.scope}`,
        r.category,
        `${r.month}月`,
        r.activityAmount.toFixed(4),
        r.activityUnit,
        r.emissionAmount.toFixed(4),
      ])
    );

    const csv = [toCsvRow(headers), ...rows].join("\n");
    downloadCsv(`月度明細_${periodYear}.csv`, csv);
  }, [monthlyDetail, periodYear]);

  // -- Stats cards --

  const stats = [
    {
      label: "範疇一合計",
      value: formatEmissionLocal(totalScope1),
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      label: "範疇二合計",
      value: formatEmissionLocal(totalScope2),
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "排放總量",
      value: formatEmissionLocal(grandTotal),
      icon: TrendingDown,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "已核准比例",
      value: `${approvalRate}%`,
      subtitle: `${approvedCount} / ${totalCount} 筆`,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  // -- Group register data by scope --

  const registerByScope = groupRegisterByScope(registerData, grandTotal);

  return (
    <>
      {/* Summary cards (always visible) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">{stat.value}</p>
            {"subtitle" in stat && stat.subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stat.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* No data notice */}
      {!hasData && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-base font-medium text-muted-foreground">
            此期間尚無已核准的排放數據
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先至「數據填報」提交並核准活動數據後，即可查看報告。
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Tab navigation */}
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Emission Report */}
          {activeTab === "report" && (
            <div className="space-y-6">
              <MonthlyEmissionsChart data={monthlyData} />

              <div className="grid gap-4 lg:grid-cols-2">
                <CategoryPieChart data={categoryData} />
                <ScopePieChart data={scopeData} />
              </div>

              {/* Detail table */}
              <div className="rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                  <h3 className="text-base font-semibold">排放源明細</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    依排放類別分組，僅含已核准資料
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-5 py-3 text-left font-medium">排放源</th>
                        <th className="px-5 py-3 text-left font-medium">廠區</th>
                        <th className="px-5 py-3 text-right font-medium">
                          年排放量 (tCO₂e)
                        </th>
                        <th className="px-5 py-3 text-right font-medium">佔比 (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryGroups.map((group) => (
                        <CategoryGroupRows
                          key={group.category}
                          group={group}
                        />
                      ))}
                      <tr className="border-t-2 bg-muted/40">
                        <td colSpan={2} className="px-5 py-3 text-right font-semibold">
                          總計
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-base font-bold">
                          {grandTotal.toFixed(4)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">
                          100.00%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* GHG breakdown */}
              <div className="rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                  <h3 className="text-base font-semibold">溫室氣體種類分析</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    各溫室氣體排放量明細
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-5 py-3 text-left font-medium">溫室氣體</th>
                        <th className="px-5 py-3 text-right font-medium">
                          排放量 (tCO₂e)
                        </th>
                        <th className="px-5 py-3 text-right font-medium">佔比 (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ghgRows.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-5 py-2.5 font-medium">{row.name}</td>
                          <td className="px-5 py-2.5 text-right font-mono">
                            {row.amount.toFixed(4)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-muted-foreground">
                            {ghgGrandTotal > 0
                              ? ((row.amount / ghgGrandTotal) * 100).toFixed(2)
                              : "0.00"}
                            %
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 bg-muted/40">
                        <td className="px-5 py-3 font-semibold">總計</td>
                        <td className="px-5 py-3 text-right font-mono text-base font-bold">
                          {ghgGrandTotal.toFixed(4)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">
                          100.00%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Inventory Register */}
          {activeTab === "register" && (
            <div className="space-y-6">
              {/* Organization info header */}
              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-semibold mb-3">盤查基本資訊</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">組織名稱：</span>
                    <span className="font-medium">{orgName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">統一編號：</span>
                    <span className="font-medium">{orgTaxId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">邊界設定方法：</span>
                    <span className="font-medium">
                      {BOUNDARY_LABELS[boundaryMethod] ?? boundaryMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">盤查期間：</span>
                    <span className="font-medium">
                      {periodName} ({periodYear})
                    </span>
                  </div>
                </div>
              </div>

              {/* Register table */}
              <div className="rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                  <h3 className="text-base font-semibold">
                    溫室氣體盤查清冊 (ISO 14064-1)
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    依範疇及排放類別分組之完整盤查登記表
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">序號</th>
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">據點</th>
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">排放源名稱</th>
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">範疇</th>
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">排放類別</th>
                        <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">活動數據<br />(年度合計)</th>
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">活動數據<br />單位</th>
                        <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">排放係數</th>
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">係數單位</th>
                        <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">係數來源</th>
                        <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">CO₂<br />(tCO₂e)</th>
                        <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">CH₄<br />(tCO₂e)</th>
                        <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">N₂O<br />(tCO₂e)</th>
                        <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">其他GHG<br />(tCO₂e)</th>
                        <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">合計<br />(tCO₂e)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registerByScope.map((scopeGroup) => (
                        <RegisterScopeGroup
                          key={scopeGroup.scope}
                          scopeGroup={scopeGroup}
                          grandTotal={grandTotal}
                        />
                      ))}
                      {/* Grand total */}
                      <tr className="border-t-2 bg-muted/40">
                        <td colSpan={10} className="px-3 py-2.5 text-right font-semibold">
                          排放總量
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          {registerByScope.reduce((s, g) => s + g.totalCo2, 0).toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          {registerByScope.reduce((s, g) => s + g.totalCh4, 0).toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          {registerByScope.reduce((s, g) => s + g.totalN2o, 0).toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          {registerByScope.reduce((s, g) => s + g.totalOther, 0).toFixed(4)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-sm font-bold">
                          {grandTotal.toFixed(4)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Export */}
          {activeTab === "export" && (
            <div className="space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-semibold mb-2">匯出報告</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  將盤查資料匯出為 CSV 檔案，可直接以 Excel 開啟（UTF-8 BOM 編碼）。
                </p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Register CSV */}
                  <div className="rounded-lg border p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold text-sm">盤查清冊 CSV</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4 flex-1">
                      完整盤查登記表，含所有排放源之活動數據、排放係數及各溫室氣體排放量明細。
                    </p>
                    <button
                      onClick={exportRegisterCsv}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      匯出盤查清冊 CSV
                    </button>
                  </div>

                  {/* Summary CSV */}
                  <div className="rounded-lg border p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-sm">排放摘要 CSV</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4 flex-1">
                      依範疇及排放類別彙總之排放量摘要表，含各類別佔比分析。
                    </p>
                    <button
                      onClick={exportSummaryCsv}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      匯出排放摘要 CSV
                    </button>
                  </div>

                  {/* Monthly CSV */}
                  <div className="rounded-lg border p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="h-5 w-5 text-emerald-600" />
                      <h4 className="font-semibold text-sm">月度明細 CSV</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4 flex-1">
                      逐月之活動數據與排放量明細，適用於趨勢分析及稽核用途。
                    </p>
                    <button
                      onClick={exportMonthlyCsv}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      匯出月度明細 CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Data preview */}
              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-base font-semibold mb-1">資料概覽</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  匯出資料涵蓋範圍
                </p>
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-muted-foreground">盤查清冊筆數</p>
                    <p className="text-2xl font-bold mt-1">{registerData.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-muted-foreground">月度資料筆數</p>
                    <p className="text-2xl font-bold mt-1">{monthlyDetail.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-muted-foreground">排放總量</p>
                    <p className="text-2xl font-bold mt-1">
                      {formatEmissionLocal(grandTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------- Sub-components ----------

function CategoryGroupRows({ group }: { group: CategoryGroup }) {
  return (
    <>
      <tr className="border-b bg-muted/30">
        <td colSpan={4} className="px-5 py-2.5 font-semibold">
          <Badge variant="outline" className="mr-2">
            {group.categoryLabel}
          </Badge>
        </td>
      </tr>
      {group.rows.map((row, idx) => (
        <tr
          key={`${group.category}-${idx}`}
          className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
        >
          <td className="px-5 py-2.5 pl-8">{row.sourceName}</td>
          <td className="px-5 py-2.5 text-muted-foreground">{row.unitName}</td>
          <td className="px-5 py-2.5 text-right font-mono">
            {row.emission.toFixed(4)}
          </td>
          <td className="px-5 py-2.5 text-right font-mono text-muted-foreground">
            {row.percentage.toFixed(2)}%
          </td>
        </tr>
      ))}
      <tr className="border-b bg-muted/10">
        <td
          colSpan={2}
          className="px-5 py-2 text-right text-sm font-medium text-muted-foreground"
        >
          小計
        </td>
        <td className="px-5 py-2 text-right font-mono font-semibold">
          {group.subtotal.toFixed(4)}
        </td>
        <td className="px-5 py-2 text-right font-mono text-muted-foreground">
          {group.subtotalPercentage.toFixed(2)}%
        </td>
      </tr>
    </>
  );
}

// -- Register scope grouping --

interface ScopeGroup {
  scope: number;
  scopeLabel: string;
  categories: {
    category: string;
    categoryLabel: string;
    rows: (RegisterRow & { index: number })[];
    subtotal: number;
    subtotalCo2: number;
    subtotalCh4: number;
    subtotalN2o: number;
    subtotalOther: number;
  }[];
  totalEmission: number;
  totalCo2: number;
  totalCh4: number;
  totalN2o: number;
  totalOther: number;
}

function groupRegisterByScope(data: RegisterRow[], _grandTotal: number): ScopeGroup[] {
  const scopeMap = new Map<number, Map<string, (RegisterRow & { index: number })[]>>();
  let idx = 0;
  for (const r of data) {
    idx++;
    if (!scopeMap.has(r.scope)) scopeMap.set(r.scope, new Map());
    const catMap = scopeMap.get(r.scope)!;
    if (!catMap.has(r.category)) catMap.set(r.category, []);
    catMap.get(r.category)!.push({ ...r, index: idx });
  }

  const result: ScopeGroup[] = [];
  for (const [scope, catMap] of Array.from(scopeMap.entries()).sort((a, b) => a[0] - b[0])) {
    const categories = Array.from(catMap.entries()).map(([cat, rows]) => ({
      category: cat,
      categoryLabel: rows[0]?.categoryLabel ?? cat,
      rows,
      subtotal: rows.reduce((s, r) => s + r.total, 0),
      subtotalCo2: rows.reduce((s, r) => s + r.co2, 0),
      subtotalCh4: rows.reduce((s, r) => s + r.ch4, 0),
      subtotalN2o: rows.reduce((s, r) => s + r.n2o, 0),
      subtotalOther: rows.reduce((s, r) => s + r.otherGhg, 0),
    }));

    result.push({
      scope,
      scopeLabel: SCOPE_LABELS[scope] ?? `範疇${scope}`,
      categories,
      totalEmission: categories.reduce((s, c) => s + c.subtotal, 0),
      totalCo2: categories.reduce((s, c) => s + c.subtotalCo2, 0),
      totalCh4: categories.reduce((s, c) => s + c.subtotalCh4, 0),
      totalN2o: categories.reduce((s, c) => s + c.subtotalN2o, 0),
      totalOther: categories.reduce((s, c) => s + c.subtotalOther, 0),
    });
  }

  return result;
}

function RegisterScopeGroup({
  scopeGroup,
  grandTotal,
}: {
  scopeGroup: ScopeGroup;
  grandTotal: number;
}) {
  return (
    <>
      {/* Scope header */}
      <tr className="border-b bg-primary/5">
        <td colSpan={15} className="px-3 py-2.5 font-semibold text-sm">
          {scopeGroup.scopeLabel}
        </td>
      </tr>
      {scopeGroup.categories.map((catGroup) => (
        <RegisterCategoryGroup
          key={catGroup.category}
          catGroup={catGroup}
        />
      ))}
      {/* Scope subtotal */}
      <tr className="border-b bg-muted/30">
        <td colSpan={10} className="px-3 py-2 text-right text-xs font-semibold">
          {scopeGroup.scopeLabel} 小計
          {grandTotal > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">
              ({((scopeGroup.totalEmission / grandTotal) * 100).toFixed(2)}%)
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {scopeGroup.totalCo2.toFixed(4)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {scopeGroup.totalCh4.toFixed(4)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {scopeGroup.totalN2o.toFixed(4)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {scopeGroup.totalOther.toFixed(4)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-bold text-xs">
          {scopeGroup.totalEmission.toFixed(4)}
        </td>
      </tr>
    </>
  );
}

function RegisterCategoryGroup({
  catGroup,
}: {
  catGroup: ScopeGroup["categories"][number];
}) {
  return (
    <>
      {/* Category header */}
      <tr className="border-b bg-muted/15">
        <td colSpan={15} className="px-3 py-1.5 pl-6 text-xs font-medium text-muted-foreground">
          {catGroup.categoryLabel}
        </td>
      </tr>
      {catGroup.rows.map((row) => (
        <tr
          key={row.index}
          className="border-b last:border-b-0 hover:bg-muted/10 transition-colors"
        >
          <td className="px-3 py-2 text-center font-mono">{row.index}</td>
          <td className="px-3 py-2 whitespace-nowrap">{row.unitName}</td>
          <td className="px-3 py-2">{row.sourceName}</td>
          <td className="px-3 py-2 whitespace-nowrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              範疇{row.scope}
            </Badge>
          </td>
          <td className="px-3 py-2 whitespace-nowrap">{row.categoryLabel}</td>
          <td className="px-3 py-2 text-right font-mono">{row.annualActivity.toFixed(2)}</td>
          <td className="px-3 py-2">{row.activityUnit}</td>
          <td className="px-3 py-2 text-right font-mono">{row.factorValue.toFixed(6)}</td>
          <td className="px-3 py-2">{row.factorUnit}</td>
          <td className="px-3 py-2 text-muted-foreground">{row.factorSource}</td>
          <td className="px-3 py-2 text-right font-mono">{row.co2.toFixed(4)}</td>
          <td className="px-3 py-2 text-right font-mono">{row.ch4.toFixed(4)}</td>
          <td className="px-3 py-2 text-right font-mono">{row.n2o.toFixed(4)}</td>
          <td className="px-3 py-2 text-right font-mono">{row.otherGhg.toFixed(4)}</td>
          <td className="px-3 py-2 text-right font-mono font-semibold">{row.total.toFixed(4)}</td>
        </tr>
      ))}
      {/* Category subtotal */}
      <tr className="border-b bg-muted/10">
        <td colSpan={10} className="px-3 py-1.5 text-right text-[11px] font-medium text-muted-foreground">
          {catGroup.categoryLabel} 小計
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-[11px]">
          {catGroup.subtotalCo2.toFixed(4)}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-[11px]">
          {catGroup.subtotalCh4.toFixed(4)}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-[11px]">
          {catGroup.subtotalN2o.toFixed(4)}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-[11px]">
          {catGroup.subtotalOther.toFixed(4)}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-[11px] font-semibold">
          {catGroup.subtotal.toFixed(4)}
        </td>
      </tr>
    </>
  );
}

// ---------- Utility ----------

function formatEmissionLocal(tco2e: number): string {
  if (tco2e >= 1000) {
    return `${(tco2e / 1000).toFixed(2)} 千公噸`;
  }
  return `${tco2e.toFixed(2)} 公噸`;
}
