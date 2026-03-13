import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CATEGORY_LABELS,
} from "@/lib/emission";
import { PeriodSelector } from "./period-selector";
import { ReportsPageClient } from "./reports-page";
import type { ReportsPageProps } from "./reports-page";
import type { MonthlyData, CategoryData, ScopeData } from "./report-charts";

interface PageProps {
  searchParams: Promise<{ periodId?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Fetch organization
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
  });

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
          factor: true,
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

  // -- Inventory register data --
  // Group by source: aggregate annual activity, emissions by GHG type
  const registerMap = new Map<
    string,
    {
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
  >();

  for (const d of activityData) {
    const key = `${d.sourceId}`;
    if (!registerMap.has(key)) {
      registerMap.set(key, {
        unitName: d.source.unit.name,
        sourceName: d.source.name,
        scope: d.source.scope,
        category: d.source.category,
        categoryLabel: CATEGORY_LABELS[d.source.category] ?? d.source.category,
        annualActivity: 0,
        activityUnit: d.activityUnit,
        factorValue: d.factor?.totalFactor ?? 0,
        factorUnit: d.factor?.unit ?? "",
        factorSource: d.factor?.source ?? "",
        co2: 0,
        ch4: 0,
        n2o: 0,
        otherGhg: 0,
        total: 0,
      });
    }
    const entry = registerMap.get(key)!;
    entry.annualActivity += d.activityAmount;
    entry.co2 += d.co2Amount ?? 0;
    entry.ch4 += d.ch4Amount ?? 0;
    entry.n2o += d.n2oAmount ?? 0;
    entry.otherGhg += d.otherGhgAmount ?? 0;
    entry.total += d.emissionAmount ?? 0;
  }

  // Sort by scope, then category, then source name
  const registerData = Array.from(registerMap.values()).sort((a, b) => {
    if (a.scope !== b.scope) return a.scope - b.scope;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.sourceName.localeCompare(b.sourceName);
  });

  // -- Monthly detail data for export --
  const monthlyDetail = activityData
    .map((d) => ({
      unitName: d.source.unit.name,
      sourceName: d.source.name,
      scope: d.source.scope,
      category: CATEGORY_LABELS[d.source.category] ?? d.source.category,
      month: d.month,
      activityAmount: d.activityAmount,
      activityUnit: d.activityUnit,
      emissionAmount: d.emissionAmount ?? 0,
    }))
    .sort((a, b) => {
      if (a.scope !== b.scope) return a.scope - b.scope;
      if (a.sourceName !== b.sourceName)
        return a.sourceName.localeCompare(b.sourceName);
      return a.month - b.month;
    });

  // Serialized periods for client component
  const serializedPeriods = periods.map((p) => ({
    id: p.id,
    name: p.name,
    year: p.year,
  }));

  // Props for client component
  const clientProps: ReportsPageProps = {
    orgName: org?.name ?? "",
    orgTaxId: org?.taxId ?? "",
    boundaryMethod: org?.boundaryMethod ?? "OPERATIONAL_CONTROL",
    periodName: selectedPeriod?.name ?? "",
    periodYear: selectedPeriod?.year ?? 0,
    monthlyData,
    categoryData,
    scopeData,
    approvalRate,
    approvedCount,
    totalCount,
    totalScope1: scope1Total,
    totalScope2: scope2Total,
    grandTotal,
    categoryGroups,
    ghgRows,
    ghgGrandTotal,
    hasData: activityData.length > 0,
    registerData,
    monthlyDetail,
  };

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

      {selectedPeriod && <ReportsPageClient {...clientProps} />}
    </div>
  );
}
