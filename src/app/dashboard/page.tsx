import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SCOPE_LABELS,
  formatEmission,
} from "@/lib/emission";
import {
  Flame,
  Zap,
  TrendingDown,
  ClipboardCheck,
  Building2,
  Database,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Get current inventory period
  const currentPeriod = await prisma.inventoryPeriod.findFirst({
    where: { orgId: user.orgId, status: { not: "LOCKED" } },
    orderBy: { year: "desc" },
  });

  // Get all active organization units
  const units = await prisma.organizationUnit.findMany({
    where: { orgId: user.orgId, isActive: true },
    orderBy: { name: "asc" },
    include: {
      emissionSources: {
        where: { isActive: true },
        select: { id: true, scope: true },
      },
    },
  });

  // Get all activity data for the current period with source and unit info
  const activityData = currentPeriod
    ? await prisma.activityData.findMany({
        where: { periodId: currentPeriod.id },
        include: {
          source: {
            include: { unit: true },
          },
        },
      })
    : [];

  // Only approved data for emission calculations
  const approvedData = activityData.filter((d) => d.status === "APPROVED");

  // Task completion
  const tasks = currentPeriod
    ? await prisma.taskAssignment.findMany({
        where: { periodId: currentPeriod.id },
      })
    : [];
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const completionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  // ---- Org-wide scope totals ----
  const scope1Total = approvedData
    .filter((d) => d.source.scope === 1)
    .reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
  const scope2Total = approvedData
    .filter((d) => d.source.scope === 2)
    .reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
  const grandTotal = scope1Total + scope2Total;

  // ---- Per-site emission breakdown ----
  interface SiteEmission {
    unitId: string;
    unitName: string;
    scope1: number;
    scope2: number;
    total: number;
    percentage: number;
    approvedCount: number;
    totalCount: number;
    sourceCount: number;
  }

  const siteMap = new Map<
    string,
    {
      name: string;
      scope1: number;
      scope2: number;
      approvedCount: number;
      totalCount: number;
      sourceCount: number;
    }
  >();

  // Initialize all units (even those with no data)
  for (const unit of units) {
    siteMap.set(unit.id, {
      name: unit.name,
      scope1: 0,
      scope2: 0,
      approvedCount: 0,
      totalCount: 0,
      sourceCount: unit.emissionSources.length,
    });
  }

  // Aggregate all activity data (not just approved) for counts
  for (const d of activityData) {
    const entry = siteMap.get(d.source.unitId);
    if (!entry) continue;
    entry.totalCount += 1;
    if (d.status === "APPROVED") {
      entry.approvedCount += 1;
      if (d.source.scope === 1) {
        entry.scope1 += d.emissionAmount ?? 0;
      } else if (d.source.scope === 2) {
        entry.scope2 += d.emissionAmount ?? 0;
      }
    }
  }

  const siteEmissions: SiteEmission[] = Array.from(siteMap.entries())
    .map(([unitId, data]) => ({
      unitId,
      unitName: data.name,
      scope1: data.scope1,
      scope2: data.scope2,
      total: data.scope1 + data.scope2,
      percentage: grandTotal > 0 ? ((data.scope1 + data.scope2) / grandTotal) * 100 : 0,
      approvedCount: data.approvedCount,
      totalCount: data.totalCount,
      sourceCount: data.sourceCount,
    }))
    .sort((a, b) => b.total - a.total);

  // ---- Monthly trend across all sites ----
  const monthlyMap = new Map<number, { scope1: number; scope2: number }>();
  for (let m = 1; m <= 12; m++) {
    monthlyMap.set(m, { scope1: 0, scope2: 0 });
  }
  for (const d of approvedData) {
    const entry = monthlyMap.get(d.month);
    if (!entry) continue;
    if (d.source.scope === 1) {
      entry.scope1 += d.emissionAmount ?? 0;
    } else if (d.source.scope === 2) {
      entry.scope2 += d.emissionAmount ?? 0;
    }
  }

  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];

  // ---- Data quality summary ----
  const qualityMap = new Map<string, number>();
  for (const d of activityData) {
    const quality = d.dataQuality ?? "UNKNOWN";
    qualityMap.set(quality, (qualityMap.get(quality) ?? 0) + 1);
  }

  const DATA_QUALITY_LABELS: Record<string, string> = {
    PRIMARY: "一級數據（實測值）",
    SECONDARY: "二級數據（係數推估）",
    ESTIMATED: "三級數據（估算值）",
    UNKNOWN: "未分類",
  };
  const DATA_QUALITY_COLORS: Record<string, string> = {
    PRIMARY: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30",
    SECONDARY: "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30",
    ESTIMATED: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30",
    UNKNOWN: "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/30",
  };

  const qualitySummary = ["PRIMARY", "SECONDARY", "ESTIMATED", "UNKNOWN"]
    .map((key) => ({
      key,
      label: DATA_QUALITY_LABELS[key],
      count: qualityMap.get(key) ?? 0,
      colorClass: DATA_QUALITY_COLORS[key],
    }))
    .filter((q) => q.count > 0);

  const totalDataEntries = activityData.length;

  // ---- Data completion rate (approved / total) ----
  const dataCompletionRate =
    totalDataEntries > 0
      ? Math.round((approvedData.length / totalDataEntries) * 100)
      : 0;

  // ---- KPI cards ----
  const stats = [
    {
      label: SCOPE_LABELS[1],
      value: formatEmission(scope1Total),
      subtitle: "直接溫室氣體排放",
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      label: SCOPE_LABELS[2],
      value: formatEmission(scope2Total),
      subtitle: "能源間接排放",
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "排放總量",
      value: formatEmission(grandTotal),
      subtitle: `${approvedData.length} 筆已核准數據`,
      icon: TrendingDown,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "數據完成率",
      value: `${dataCompletionRate}%`,
      subtitle: `${approvedData.length} / ${totalDataEntries} 筆核准`,
      icon: ClipboardCheck,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "盤查據點數",
      value: `${units.length}`,
      subtitle: "組織單位",
      icon: Building2,
      color: "text-violet-600",
      bgColor: "bg-violet-50 dark:bg-violet-950/30",
    },
  ];

  // Find the highest emission month
  let peakMonth = "";
  let peakValue = 0;
  for (const [month, values] of monthlyMap.entries()) {
    const total = values.scope1 + values.scope2;
    if (total > peakValue) {
      peakValue = total;
      peakMonth = monthNames[month - 1];
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {currentPeriod ? currentPeriod.name : "碳排管理儀表板"}
        </h1>
        <p className="text-muted-foreground">
          {user.organization.name} — 多據點碳排數據管理總覽
        </p>
      </div>

      {/* No period fallback */}
      {!currentPeriod && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚未建立盤查期間
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先至「碳盤查管理」建立年度盤查期間，開始進行溫室氣體盤查作業。
          </p>
        </div>
      )}

      {currentPeriod && (
        <>
          {/* KPI cards - 5 cards, responsive grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stat.subtitle}
                </p>
              </div>
            ))}
          </div>

          {/* No data notice */}
          {activityData.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="text-base font-medium text-muted-foreground">
                此期間尚無排放數據
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                請先至「數據填報」提交活動數據，或至「組織管理」新增據點與排放源。
              </p>
            </div>
          )}

          {activityData.length > 0 && (
            <>
              {/* ===== Per-site emission table ===== */}
              <div className="rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-base font-semibold">
                      各據點排放數據
                    </h3>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    依組織單位彙整範疇一、範疇二排放量（僅含已核准數據）
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-5 py-3 text-left font-medium">
                          據點名稱
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          範疇一 (tCO₂e)
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          範疇二 (tCO₂e)
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          合計 (tCO₂e)
                        </th>
                        <th className="px-5 py-3 text-right font-medium">
                          佔比
                        </th>
                        <th className="px-5 py-3 text-center font-medium">
                          數據狀態
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {siteEmissions.map((site) => {
                        const statusColor =
                          site.totalCount === 0
                            ? "text-gray-500"
                            : site.approvedCount === site.totalCount
                              ? "text-emerald-600"
                              : "text-amber-600";
                        const statusLabel =
                          site.totalCount === 0
                            ? "尚無數據"
                            : site.approvedCount === site.totalCount
                              ? "全部核准"
                              : `${site.approvedCount}/${site.totalCount} 核准`;
                        return (
                          <tr
                            key={site.unitId}
                            className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-5 py-2.5">
                              <div>
                                <span className="font-medium">
                                  {site.unitName}
                                </span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({site.sourceCount} 排放源)
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono">
                              {site.scope1.toFixed(4)}
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono">
                              {site.scope2.toFixed(4)}
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono font-semibold">
                              {site.total.toFixed(4)}
                            </td>
                            <td className="px-5 py-2.5 text-right font-mono text-muted-foreground">
                              {site.percentage.toFixed(1)}%
                            </td>
                            <td className="px-5 py-2.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium ${statusColor}`}
                              >
                                {site.totalCount > 0 &&
                                  site.approvedCount === site.totalCount && (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                {site.totalCount > 0 &&
                                  site.approvedCount < site.totalCount && (
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  )}
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Grand total row */}
                      <tr className="border-t-2 bg-muted/40">
                        <td className="px-5 py-3 font-semibold">
                          全組織合計
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">
                          {scope1Total.toFixed(4)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">
                          {scope2Total.toFixed(4)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-base font-bold">
                          {grandTotal.toFixed(4)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">
                          100.0%
                        </td>
                        <td className="px-5 py-3 text-center text-xs font-medium text-muted-foreground">
                          {approvedData.length}/{totalDataEntries} 筆
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ===== Monthly trend + Data quality side by side ===== */}
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Monthly trend (takes 2 cols) */}
                <div className="rounded-xl border bg-card lg:col-span-2">
                  <div className="border-b px-5 py-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-base font-semibold">
                        月度排放趨勢
                      </h3>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      全據點各月排放量彙總（已核准數據）
                      {peakValue > 0 && (
                        <span className="ml-2">
                          — 峰值月份：
                          <span className="font-medium text-foreground">
                            {peakMonth}
                          </span>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="p-5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-3 py-2 text-left font-medium">
                              月份
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              範疇一
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              範疇二
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              合計
                            </th>
                            <th className="min-w-[120px] px-3 py-2 text-left font-medium">
                              分布
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(monthlyMap.entries()).map(
                            ([month, values]) => {
                              const monthTotal =
                                values.scope1 + values.scope2;
                              const barWidth =
                                peakValue > 0
                                  ? (monthTotal / peakValue) * 100
                                  : 0;
                              const scope1Width =
                                monthTotal > 0
                                  ? (values.scope1 / monthTotal) * barWidth
                                  : 0;
                              const scope2Width = barWidth - scope1Width;
                              return (
                                <tr
                                  key={month}
                                  className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                                >
                                  <td className="px-3 py-2 font-medium">
                                    {monthNames[month - 1]}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-sm">
                                    {values.scope1 > 0
                                      ? values.scope1.toFixed(4)
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-sm">
                                    {values.scope2 > 0
                                      ? values.scope2.toFixed(4)
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-sm font-semibold">
                                    {monthTotal > 0
                                      ? monthTotal.toFixed(4)
                                      : "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {monthTotal > 0 ? (
                                      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                          className="h-full bg-orange-500 transition-all"
                                          style={{
                                            width: `${scope1Width}%`,
                                          }}
                                        />
                                        <div
                                          className="h-full bg-blue-500 transition-all"
                                          style={{
                                            width: `${scope2Width}%`,
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="h-4 w-full rounded-full bg-muted" />
                                    )}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* Legend */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-sm bg-orange-500" />
                        範疇一
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" />
                        範疇二
                      </span>
                    </div>
                  </div>
                </div>

                {/* Data quality summary (takes 1 col) */}
                <div className="rounded-xl border bg-card">
                  <div className="border-b px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-base font-semibold">數據品質分析</h3>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      活動數據品質等級分布
                    </p>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Total entries */}
                    <div className="text-center">
                      <p className="text-3xl font-bold">{totalDataEntries}</p>
                      <p className="text-sm text-muted-foreground">
                        總數據筆數
                      </p>
                    </div>

                    {/* Quality breakdown */}
                    <div className="space-y-3">
                      {qualitySummary.map((q) => {
                        const pct =
                          totalDataEntries > 0
                            ? (q.count / totalDataEntries) * 100
                            : 0;
                        return (
                          <div key={q.key}>
                            <div className="flex items-center justify-between text-sm">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${q.colorClass}`}
                              >
                                {q.label}
                              </span>
                              <span className="font-mono font-medium">
                                {q.count} 筆
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  q.key === "PRIMARY"
                                    ? "bg-emerald-500"
                                    : q.key === "SECONDARY"
                                      ? "bg-blue-500"
                                      : q.key === "ESTIMATED"
                                        ? "bg-amber-500"
                                        : "bg-gray-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="mt-0.5 text-right text-xs text-muted-foreground">
                              {pct.toFixed(1)}%
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {qualitySummary.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground">
                        尚無數據品質資訊
                      </p>
                    )}

                    {/* Completion gauge */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          盤查進度
                        </span>
                        <span className="font-semibold">
                          {completionRate}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            completionRate >= 80
                              ? "bg-emerald-500"
                              : completionRate >= 50
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {completedTasks} / {tasks.length} 項任務完成
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== Scope breakdown by site (visual comparison) ===== */}
              <div className="rounded-xl border bg-card">
                <div className="border-b px-5 py-4">
                  <h3 className="text-base font-semibold">
                    據點排放佔比分析
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    各據點排放量相對比例（範疇一 + 範疇二）
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  {siteEmissions
                    .filter((s) => s.total > 0)
                    .map((site) => {
                      const scope1Pct =
                        site.total > 0
                          ? (site.scope1 / site.total) * 100
                          : 0;
                      return (
                        <div key={site.unitId}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {site.unitName}
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {formatEmission(site.total)} ({site.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="mt-1 flex h-5 w-full overflow-hidden rounded-lg bg-muted">
                            <div
                              className="h-full bg-orange-500/80 transition-all"
                              style={{
                                width: `${site.percentage * (scope1Pct / 100)}%`,
                              }}
                              title={`範疇一：${site.scope1.toFixed(4)} tCO₂e`}
                            />
                            <div
                              className="h-full bg-blue-500/80 transition-all"
                              style={{
                                width: `${site.percentage * ((100 - scope1Pct) / 100)}%`,
                              }}
                              title={`範疇二：${site.scope2.toFixed(4)} tCO₂e`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {siteEmissions.every((s) => s.total === 0) && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      尚無已核准排放數據
                    </p>
                  )}
                  {/* Legend */}
                  {siteEmissions.some((s) => s.total > 0) && (
                    <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-sm bg-orange-500/80" />
                        範疇一（直接排放）
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-sm bg-blue-500/80" />
                        範疇二（間接排放）
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
