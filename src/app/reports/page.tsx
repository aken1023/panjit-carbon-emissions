import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SCOPE_LABELS,
  CATEGORY_LABELS,
  formatEmission,
} from "@/lib/emission";
import { Flame, Zap, TrendingDown, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PeriodSelector } from "./period-selector";
import {
  MonthlyEmissionsChart,
  CategoryPieChart,
  ScopePieChart,
} from "./report-charts";
import type {
  MonthlyData,
  CategoryData,
  ScopeData,
} from "./report-charts";

interface PageProps {
  searchParams: Promise<{ periodId?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Fetch all periods for this org
  const periods = await prisma.inventoryPeriod.findMany({
    where: { orgId: user.orgId },
    orderBy: { year: "desc" },
  });

  // Determine selected period
  const selectedPeriodId =
    params.periodId ?? periods[0]?.id ?? null;
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) ?? null;

  // Fetch approved activity data for selected period
  const activityData = selectedPeriod
    ? await prisma.activityData.findMany({
        where: { periodId: selectedPeriod.id, status: "APPROVED" },
        include: {
          source: {
            include: { unit: true },
          },
        },
      })
    : [];

  // Total counts for approval rate
  const totalCount = selectedPeriod
    ? await prisma.activityData.count({
        where: { periodId: selectedPeriod.id },
      })
    : 0;
  const approvedCount = activityData.length;
  const approvalRate =
    totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  // -- Compute aggregated data --

  // Scope totals
  const scope1Total = activityData
    .filter((d) => d.source.scope === 1)
    .reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
  const scope2Total = activityData
    .filter((d) => d.source.scope === 2)
    .reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
  const grandTotal = scope1Total + scope2Total;

  // Monthly data for bar chart
  const monthlyMap = new Map<number, { scope1: number; scope2: number }>();
  for (let m = 1; m <= 12; m++) {
    monthlyMap.set(m, { scope1: 0, scope2: 0 });
  }
  for (const d of activityData) {
    const entry = monthlyMap.get(d.month)!;
    if (d.source.scope === 1) {
      entry.scope1 += d.emissionAmount ?? 0;
    } else if (d.source.scope === 2) {
      entry.scope2 += d.emissionAmount ?? 0;
    }
  }
  const monthlyData: MonthlyData[] = Array.from(monthlyMap.entries()).map(
    ([month, values]) => ({
      month: `${month}月`,
      scope1: parseFloat(values.scope1.toFixed(4)),
      scope2: parseFloat(values.scope2.toFixed(4)),
    })
  );

  // Category data for pie chart
  const categoryMap = new Map<string, number>();
  for (const d of activityData) {
    const cat = d.source.category;
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + (d.emissionAmount ?? 0));
  }
  const categoryData: CategoryData[] = Array.from(categoryMap.entries()).map(
    ([key, value]) => ({
      name: CATEGORY_LABELS[key] ?? key,
      value: parseFloat(value.toFixed(4)),
    })
  );

  // Scope data for pie chart
  const scopeData: ScopeData[] = [
    { name: "範疇一", value: parseFloat(scope1Total.toFixed(4)) },
    { name: "範疇二", value: parseFloat(scope2Total.toFixed(4)) },
  ];

  // Detail table: grouped by category
  interface DetailRow {
    sourceName: string;
    unitName: string;
    emission: number;
    percentage: number;
  }
  interface CategoryGroup {
    category: string;
    categoryLabel: string;
    rows: DetailRow[];
    subtotal: number;
    subtotalPercentage: number;
  }

  const detailGroupMap = new Map<
    string,
    { label: string; rows: Map<string, { unitName: string; emission: number }> }
  >();
  for (const d of activityData) {
    const cat = d.source.category;
    if (!detailGroupMap.has(cat)) {
      detailGroupMap.set(cat, {
        label: CATEGORY_LABELS[cat] ?? cat,
        rows: new Map(),
      });
    }
    const group = detailGroupMap.get(cat)!;
    const key = `${d.source.name}||${d.source.unit.name}`;
    if (!group.rows.has(key)) {
      group.rows.set(key, { unitName: d.source.unit.name, emission: 0 });
    }
    group.rows.get(key)!.emission += d.emissionAmount ?? 0;
  }

  const categoryGroups: CategoryGroup[] = Array.from(
    detailGroupMap.entries()
  ).map(([category, group]) => {
    const rows: DetailRow[] = Array.from(group.rows.entries()).map(
      ([key, data]) => ({
        sourceName: key.split("||")[0],
        unitName: data.unitName,
        emission: data.emission,
        percentage: grandTotal > 0 ? (data.emission / grandTotal) * 100 : 0,
      })
    );
    const subtotal = rows.reduce((sum, r) => sum + r.emission, 0);
    return {
      category,
      categoryLabel: group.label,
      rows: rows.sort((a, b) => b.emission - a.emission),
      subtotal,
      subtotalPercentage: grandTotal > 0 ? (subtotal / grandTotal) * 100 : 0,
    };
  });
  categoryGroups.sort((a, b) => b.subtotal - a.subtotal);

  // GHG breakdown
  const ghgTotals = {
    co2: 0,
    ch4: 0,
    n2o: 0,
    other: 0,
  };
  for (const d of activityData) {
    ghgTotals.co2 += d.co2Amount ?? 0;
    ghgTotals.ch4 += d.ch4Amount ?? 0;
    ghgTotals.n2o += d.n2oAmount ?? 0;
    ghgTotals.other += d.otherGhgAmount ?? 0;
  }
  const ghgGrandTotal =
    ghgTotals.co2 + ghgTotals.ch4 + ghgTotals.n2o + ghgTotals.other;

  const ghgRows = [
    { name: "CO₂", amount: ghgTotals.co2 },
    { name: "CH₄", amount: ghgTotals.ch4 },
    { name: "N₂O", amount: ghgTotals.n2o },
    { name: "其他 (HFCs+PFCs+SF₆+NF₃)", amount: ghgTotals.other },
  ];

  // Stats cards
  const stats = [
    {
      label: "範疇一合計",
      value: formatEmission(scope1Total),
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      label: "範疇二合計",
      value: formatEmission(scope2Total),
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "排放總量",
      value: formatEmission(grandTotal),
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

  // Serialized periods for client component
  const serializedPeriods = periods.map((p) => ({
    id: p.id,
    name: p.name,
    year: p.year,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">揭露報告</h1>
          <p className="text-muted-foreground">
            排放數據分析與報告產出
          </p>
        </div>
        <PeriodSelector
          periods={serializedPeriods}
          selectedId={selectedPeriodId}
        />
      </div>

      {/* No period fallback */}
      {!selectedPeriod && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚未建立盤查期間
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先至「碳盤查管理」建立年度盤查期間，開始進行溫室氣體盤查作業。
          </p>
        </div>
      )}

      {selectedPeriod && (
        <>
          {/* Summary cards */}
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

          {/* No approved data notice */}
          {activityData.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="text-base font-medium text-muted-foreground">
                此期間尚無已核准的排放數據
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                請先至「數據填報」提交並核准活動數據後，即可查看報告。
              </p>
            </div>
          )}

          {activityData.length > 0 && (
            <>
              {/* Charts section */}
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
                        <th className="px-5 py-3 text-left font-medium">
                          排放源
                        </th>
                        <th className="px-5 py-3 text-left font-medium">
                          廠區
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          年排放量 (tCO₂e)
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          佔比 (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryGroups.map((group) => (
                        <>
                          {/* Category header */}
                          <tr
                            key={`header-${group.category}`}
                            className="border-b bg-muted/30"
                          >
                            <td
                              colSpan={4}
                              className="px-5 py-2.5 font-semibold"
                            >
                              <Badge variant="outline" className="mr-2">
                                {group.categoryLabel}
                              </Badge>
                            </td>
                          </tr>
                          {/* Rows */}
                          {group.rows.map((row, idx) => (
                            <tr
                              key={`${group.category}-${idx}`}
                              className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                            >
                              <td className="px-5 py-2.5 pl-8">
                                {row.sourceName}
                              </td>
                              <td className="px-5 py-2.5 text-muted-foreground">
                                {row.unitName}
                              </td>
                              <td className="px-5 py-2.5 text-right font-mono">
                                {row.emission.toFixed(4)}
                              </td>
                              <td className="px-5 py-2.5 text-right font-mono text-muted-foreground">
                                {row.percentage.toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                          {/* Subtotal */}
                          <tr
                            key={`subtotal-${group.category}`}
                            className="border-b bg-muted/10"
                          >
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
                      ))}
                      {/* Grand total */}
                      <tr className="border-t-2 bg-muted/40">
                        <td
                          colSpan={2}
                          className="px-5 py-3 text-right font-semibold"
                        >
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

              {/* GHG breakdown table */}
              <div className="rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                  <h3 className="text-base font-semibold">
                    溫室氣體種類分析
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    各溫室氣體排放量明細
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-5 py-3 text-left font-medium">
                          溫室氣體
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          排放量 (tCO₂e)
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          佔比 (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ghgRows.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-5 py-2.5 font-medium">
                            {row.name}
                          </td>
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
                      {/* Total */}
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
            </>
          )}
        </>
      )}
    </div>
  );
}
