"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  Globe,
  Factory,
  ClipboardList,
  Download,
  Building2,
  Flame,
  Zap,
  TrendingDown,
  Target,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComplianceData {
  sourceName: string;
  sourceCategory: string;
  sourceScope: string;
  unitName: string;
  month: number;
  activityAmount: number;
  activityUnit: string;
  emissionAmount: number;
  co2Amount: number;
  ch4Amount: number;
  n2oAmount: number;
  otherGhgAmount: number;
  factorName: string;
  factorValue: number;
  factorUnit: string;
  factorSource: string;
  dataQuality: string;
}

interface ReductionTarget {
  baseYear: number;
  targetYear: number;
  targetType: string;
  reductionPct: number;
  baselineAmount: number;
}

interface CompliancePageProps {
  orgName: string;
  orgTaxId: string;
  orgIndustry: string;
  boundaryMethod: string;
  unitCount: number;
  periodName: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  data: ComplianceData[];
  reductionTargets: ReductionTarget[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  { id: "iso14064", label: "ISO 14064-1 盤查報告", icon: FileText },
  { id: "esg", label: "ESG 揭露報告", icon: Globe },
  { id: "cbam", label: "CBAM 申報資料", icon: Factory },
  { id: "register", label: "溫室氣體盤查清冊", icon: ClipboardList },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SCOPE_LABELS: Record<string, string> = {
  SCOPE_1: "範疇一（直接排放）",
  SCOPE_2: "範疇二（能源間接排放）",
  SCOPE_3: "範疇三（其他間接排放）",
};

const SCOPE_SHORT: Record<string, string> = {
  SCOPE_1: "範疇一",
  SCOPE_2: "範疇二",
  SCOPE_3: "範疇三",
};

const BOUNDARY_LABELS: Record<string, string> = {
  OPERATIONAL_CONTROL: "營運控制法",
  FINANCIAL_CONTROL: "財務控制法",
  EQUITY_SHARE: "股權比例法",
};

const CATEGORY_LABELS: Record<string, string> = {
  STATIONARY_COMBUSTION: "固定燃燒",
  MOBILE_COMBUSTION: "移動燃燒",
  PROCESS_EMISSION: "製程排放",
  FUGITIVE_EMISSION: "逸散排放",
  PURCHASED_ELECTRICITY: "外購電力",
  PURCHASED_STEAM: "外購蒸汽",
  UPSTREAM_TRANSPORT: "上游運輸",
  EMPLOYEE_COMMUTE: "員工通勤",
  BUSINESS_TRAVEL: "商務旅行",
  WASTE_DISPOSAL: "廢棄物處理",
  PURCHASED_GOODS: "購買商品",
  WATER_SUPPLY: "自來水供應",
};

const QUALITY_LABELS: Record<string, string> = {
  PRIMARY: "實測值",
  SECONDARY: "次級數據",
  ESTIMATED: "估算值",
};

const QUALITY_COLORS: Record<string, string> = {
  PRIMARY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  SECONDARY: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ESTIMATED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const FACTOR_SOURCE_LABELS: Record<string, string> = {
  EPA_TW: "環境部",
  IPCC_AR6: "IPCC AR6",
  GHG_PROTOCOL: "GHG Protocol",
  DEFRA: "DEFRA",
  CUSTOM: "自訂",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, digits = 4): string {
  return n.toFixed(digits);
}

function fmtEmission(tco2e: number): string {
  if (tco2e >= 1000) return `${(tco2e / 1000).toFixed(2)} 千公噸`;
  return `${tco2e.toFixed(2)} 公噸`;
}

function pct(part: number, total: number): string {
  if (total === 0) return "0.00";
  return ((part / total) * 100).toFixed(2);
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------

interface ScopeSummary {
  scope: string;
  label: string;
  total: number;
  co2: number;
  ch4: number;
  n2o: number;
  other: number;
  sources: SourceSummary[];
}

interface SourceSummary {
  sourceName: string;
  unitName: string;
  category: string;
  categoryLabel: string;
  scope: string;
  totalEmission: number;
  co2: number;
  ch4: number;
  n2o: number;
  other: number;
  annualActivity: number;
  activityUnit: string;
  factorName: string;
  factorValue: number;
  factorUnit: string;
  factorSource: string;
  dataQuality: string;
}

function useDerivedData(data: ComplianceData[]) {
  return useMemo(() => {
    const sourceMap = new Map<string, SourceSummary>();
    for (const d of data) {
      const key = `${d.unitName}::${d.sourceName}`;
      if (!sourceMap.has(key)) {
        sourceMap.set(key, {
          sourceName: d.sourceName,
          unitName: d.unitName,
          category: d.sourceCategory,
          categoryLabel: CATEGORY_LABELS[d.sourceCategory] ?? d.sourceCategory,
          scope: d.sourceScope,
          totalEmission: 0,
          co2: 0,
          ch4: 0,
          n2o: 0,
          other: 0,
          annualActivity: 0,
          activityUnit: d.activityUnit,
          factorName: d.factorName,
          factorValue: d.factorValue,
          factorUnit: d.factorUnit,
          factorSource: d.factorSource,
          dataQuality: d.dataQuality,
        });
      }
      const s = sourceMap.get(key)!;
      s.totalEmission += d.emissionAmount;
      s.co2 += d.co2Amount;
      s.ch4 += d.ch4Amount;
      s.n2o += d.n2oAmount;
      s.other += d.otherGhgAmount;
      s.annualActivity += d.activityAmount;
    }

    const sources = Array.from(sourceMap.values());

    const scopeOrder = ["SCOPE_1", "SCOPE_2", "SCOPE_3"];
    const scopeGroups: ScopeSummary[] = scopeOrder
      .map((scope) => {
        const scopeSources = sources.filter((s) => s.scope === scope);
        return {
          scope,
          label: SCOPE_LABELS[scope] ?? scope,
          total: scopeSources.reduce((a, s) => a + s.totalEmission, 0),
          co2: scopeSources.reduce((a, s) => a + s.co2, 0),
          ch4: scopeSources.reduce((a, s) => a + s.ch4, 0),
          n2o: scopeSources.reduce((a, s) => a + s.n2o, 0),
          other: scopeSources.reduce((a, s) => a + s.other, 0),
          sources: scopeSources,
        };
      })
      .filter((g) => g.sources.length > 0);

    const grandTotal = scopeGroups.reduce((a, g) => a + g.total, 0);
    const totalCo2 = scopeGroups.reduce((a, g) => a + g.co2, 0);
    const totalCh4 = scopeGroups.reduce((a, g) => a + g.ch4, 0);
    const totalN2o = scopeGroups.reduce((a, g) => a + g.n2o, 0);
    const totalOther = scopeGroups.reduce((a, g) => a + g.other, 0);

    const scope1 = scopeGroups.find((g) => g.scope === "SCOPE_1")?.total ?? 0;
    const scope2 = scopeGroups.find((g) => g.scope === "SCOPE_2")?.total ?? 0;

    const qualityCounts: Record<string, number> = {};
    for (const d of data) {
      qualityCounts[d.dataQuality] = (qualityCounts[d.dataQuality] ?? 0) + 1;
    }

    const unitNames = [...new Set(sources.map((s) => s.unitName))];

    return {
      sources,
      scopeGroups,
      grandTotal,
      totalCo2,
      totalCh4,
      totalN2o,
      totalOther,
      scope1,
      scope2,
      qualityCounts,
      unitNames,
      sourceCount: sources.length,
      dataCount: data.length,
    };
  }, [data]);
}

type DerivedData = ReturnType<typeof useDerivedData>;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CompliancePage(props: CompliancePageProps) {
  const [activeTab, setActiveTab] = useState<TabId>("iso14064");

  const {
    orgName,
    orgTaxId,
    orgIndustry,
    boundaryMethod,
    unitCount,
    periodName,
    periodYear,
    periodStart,
    periodEnd,
    data,
    reductionTargets,
  } = props;

  const derived = useDerivedData(data);
  const hasData = data.length > 0;

  const stats = [
    {
      label: "範疇一排放",
      value: fmtEmission(derived.scope1),
      icon: Flame,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/30",
    },
    {
      label: "範疇二排放",
      value: fmtEmission(derived.scope2),
      icon: Zap,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "排放總量",
      value: fmtEmission(derived.grandTotal),
      icon: TrendingDown,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "排放源數量",
      value: `${derived.sourceCount} 項`,
      icon: Target,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
  ];

  return (
    <>
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <div className={`rounded-lg p-2 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* No data */}
      {!hasData && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-base font-medium text-muted-foreground">
            此期間尚無已核准的排放數據
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先至「數據填報」提交並核准活動數據後，即可產生合規報告。
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Tab navigation */}
          <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/50 p-1">
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

          {activeTab === "iso14064" && (
            <ISO14064Tab
              orgName={orgName}
              orgTaxId={orgTaxId}
              orgIndustry={orgIndustry}
              boundaryMethod={boundaryMethod}
              unitCount={unitCount}
              periodName={periodName}
              periodYear={periodYear}
              periodStart={periodStart}
              periodEnd={periodEnd}
              derived={derived}
              reductionTargets={reductionTargets}
            />
          )}

          {activeTab === "esg" && (
            <ESGTab
              periodYear={periodYear}
              derived={derived}
              reductionTargets={reductionTargets}
            />
          )}

          {activeTab === "cbam" && (
            <CBAMTab
              orgName={orgName}
              orgTaxId={orgTaxId}
              orgIndustry={orgIndustry}
              periodYear={periodYear}
              periodStart={periodStart}
              periodEnd={periodEnd}
              derived={derived}
            />
          )}

          {activeTab === "register" && (
            <RegisterTab
              orgName={orgName}
              orgTaxId={orgTaxId}
              boundaryMethod={boundaryMethod}
              periodName={periodName}
              periodYear={periodYear}
              data={data}
              derived={derived}
            />
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-5 py-4">
        <h3 className="text-base font-semibold">
          {number && (
            <span className="text-muted-foreground mr-2">{number}</span>
          )}
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DownloadButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => {
        /* placeholder - download not yet implemented */
      }}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: ISO 14064-1
// ---------------------------------------------------------------------------

function ISO14064Tab({
  orgName,
  orgTaxId,
  orgIndustry,
  boundaryMethod,
  unitCount,
  periodName,
  periodYear,
  periodStart,
  periodEnd,
  derived,
  reductionTargets,
}: {
  orgName: string;
  orgTaxId: string;
  orgIndustry: string;
  boundaryMethod: string;
  unitCount: number;
  periodName: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  derived: DerivedData;
  reductionTargets: ReductionTarget[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DownloadButton label="下載報告 (ISO 14064-1)" />
      </div>

      {/* 1. Organization description */}
      <Section number="1" title="組織描述" subtitle="Organization Description">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <InfoField label="組織名稱" value={orgName} />
          <InfoField label="統一編號" value={orgTaxId} />
          <InfoField label="產業別" value={orgIndustry || "-"} />
          <InfoField
            label="報告期間"
            value={`${periodName} (${formatDate(periodStart)} ~ ${formatDate(periodEnd)})`}
          />
          <InfoField label="據點數量" value={`${unitCount} 個`} />
          <InfoField label="報告年度" value={`${periodYear}`} />
        </div>
      </Section>

      {/* 2. Boundary */}
      <Section
        number="2"
        title="組織邊界與盤查邊界"
        subtitle="Organizational & Operational Boundaries"
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium mb-1">組織邊界設定方法</p>
            <p className="text-muted-foreground">
              {BOUNDARY_LABELS[boundaryMethod] ?? boundaryMethod}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium mb-1">營運邊界</p>
            <p className="text-muted-foreground">
              涵蓋範疇一（直接排放）及範疇二（能源間接排放）
              {derived.scopeGroups.some((g) => g.scope === "SCOPE_3") &&
                "，以及範疇三（其他間接排放）"}
              之溫室氣體排放源。
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium mb-1">納入盤查之據點</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {derived.unitNames.map((name) => (
                <Badge key={name} variant="outline">
                  <Building2 className="h-3 w-3 mr-1" />
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 3. Emission sources */}
      <Section
        number="3"
        title="排放源鑑別"
        subtitle="Identification of GHG Sources & Sinks"
      >
        <div className="space-y-4">
          {derived.scopeGroups.map((sg) => (
            <div key={sg.scope} className="rounded-lg border">
              <div className="border-b bg-muted/30 px-4 py-3">
                <p className="text-sm font-semibold">{sg.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sg.sources.length} 項排放源，合計 {fmt(sg.total)} tCO2e
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="px-4 py-2 text-left font-medium">
                        排放源
                      </th>
                      <th className="px-4 py-2 text-left font-medium">據點</th>
                      <th className="px-4 py-2 text-left font-medium">
                        排放類別
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        排放量 (tCO2e)
                      </th>
                      <th className="px-4 py-2 text-right font-medium">佔比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sg.sources.map((src, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-b-0 hover:bg-muted/10 transition-colors"
                      >
                        <td className="px-4 py-2">{src.sourceName}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {src.unitName}
                        </td>
                        <td className="px-4 py-2">{src.categoryLabel}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {fmt(src.totalEmission)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                          {pct(src.totalEmission, derived.grandTotal)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Quantification results */}
      <Section
        number="4"
        title="量化結果"
        subtitle="Quantification of GHG Emissions"
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium">範疇</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    CO2 (tCO2e)
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    CH4 (tCO2e)
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    N2O (tCO2e)
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    其他 GHG (tCO2e)
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    合計 (tCO2e)
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">佔比</th>
                </tr>
              </thead>
              <tbody>
                {derived.scopeGroups.map((sg) => (
                  <tr
                    key={sg.scope}
                    className="border-b hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {SCOPE_SHORT[sg.scope] ?? sg.scope}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(sg.co2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(sg.ch4)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(sg.n2o)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(sg.other)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {fmt(sg.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {pct(sg.total, derived.grandTotal)}%
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 bg-muted/40">
                  <td className="px-4 py-2.5 font-semibold">總計</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">
                    {fmt(derived.totalCo2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">
                    {fmt(derived.totalCh4)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">
                    {fmt(derived.totalN2o)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">
                    {fmt(derived.totalOther)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-base font-bold">
                    {fmt(derived.grandTotal)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    100.00%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* GHG breakdown cards */}
          <div className="rounded-lg bg-muted/20 p-4">
            <p className="text-sm font-medium mb-3">溫室氣體種類分析</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <GhgCard
                label="二氧化碳 (CO2)"
                value={derived.totalCo2}
                total={derived.grandTotal}
              />
              <GhgCard
                label="甲烷 (CH4)"
                value={derived.totalCh4}
                total={derived.grandTotal}
              />
              <GhgCard
                label="氧化亞氮 (N2O)"
                value={derived.totalN2o}
                total={derived.grandTotal}
              />
              <GhgCard
                label="其他 GHG"
                value={derived.totalOther}
                total={derived.grandTotal}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* 5. Data quality */}
      <Section
        number="5"
        title="數據品質管理"
        subtitle="Data Quality Management"
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium">
                    數據品質等級
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    資料筆數
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">佔比</th>
                  <th className="px-4 py-2.5 text-left font-medium">說明</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(derived.qualityCounts).map(
                  ([quality, count]) => (
                    <tr key={quality} className="border-b last:border-b-0">
                      <td className="px-4 py-2.5">
                        <Badge className={QUALITY_COLORS[quality] ?? ""}>
                          {QUALITY_LABELS[quality] ?? quality}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {count}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                        {pct(count, derived.dataCount)}%
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {quality === "PRIMARY" &&
                          "直接量測或計量設備取得之數據"}
                        {quality === "SECONDARY" &&
                          "來自公開資料庫或供應商提供之數據"}
                        {quality === "ESTIMATED" &&
                          "基於假設或推估之數據"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  不確定性評估
                </p>
                <p className="text-amber-700 dark:text-amber-400 mt-1">
                  依據 ISO 14064-1 第 7.3
                  節要求，本報告採用誤差傳遞法進行不確定性評估。
                  整體排放量之不確定性應控制於 +/-5%
                  以內，以確保報告之可靠性。
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* 6. Reduction targets */}
      {reductionTargets.length > 0 && (
        <Section
          number="6"
          title="減量目標與措施"
          subtitle="GHG Reduction Targets"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium">
                    基準年
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    目標年
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    目標類型
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    減量比例
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    基準排放量 (tCO2e)
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    目標排放量 (tCO2e)
                  </th>
                </tr>
              </thead>
              <tbody>
                {reductionTargets.map((t, i) => (
                  <tr
                    key={i}
                    className="border-b last:border-b-0 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono">{t.baseYear}</td>
                    <td className="px-4 py-2.5 font-mono">{t.targetYear}</td>
                    <td className="px-4 py-2.5">
                      {t.targetType === "ABSOLUTE" ? "絕對減量" : "強度減量"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {t.reductionPct}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmt(t.baselineAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {fmt(t.baselineAmount * (1 - t.reductionPct / 100))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: ESG Disclosure
// ---------------------------------------------------------------------------

function ESGTab({
  periodYear,
  derived,
  reductionTargets,
}: {
  periodYear: number;
  derived: DerivedData;
  reductionTargets: ReductionTarget[];
}) {
  const scope3Total =
    derived.scopeGroups.find((g) => g.scope === "SCOPE_3")?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DownloadButton label="下載報告 (ESG 揭露)" />
      </div>

      {/* GRI 305 */}
      <Section
        title="GRI 305 排放指標"
        subtitle="GRI 305: Emissions Disclosure"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              code="GRI 305-1"
              label="直接（範疇一）溫室氣體排放"
              value={`${fmt(derived.scope1)} tCO2e`}
              detail="固定燃燒、移動燃燒、製程排放、逸散排放"
            />
            <MetricCard
              code="GRI 305-2"
              label="能源間接（範疇二）溫室氣體排放"
              value={`${fmt(derived.scope2)} tCO2e`}
              detail="外購電力、外購蒸汽"
            />
            <MetricCard
              code="GRI 305-3"
              label="其他間接（範疇三）溫室氣體排放"
              value={`${fmt(scope3Total)} tCO2e`}
              detail="上游運輸、員工通勤、商務旅行、廢棄物處理等"
            />
            <MetricCard
              code="GRI 305-4"
              label="溫室氣體排放強度"
              value={`${fmt(derived.grandTotal)} tCO2e / 年`}
              detail="以年度為單位之排放強度指標"
            />
            <MetricCard
              code="GRI 305-5"
              label="溫室氣體排放減量"
              value={
                reductionTargets.length > 0
                  ? `目標減量 ${reductionTargets[0].reductionPct}%`
                  : "尚未設定"
              }
              detail="相對基準年之減量進度"
            />
          </div>

          {/* GHG types table */}
          <div className="rounded-lg border">
            <div className="border-b bg-muted/20 px-4 py-3">
              <p className="text-sm font-medium">
                溫室氣體排放明細（依氣體種類）
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="px-4 py-2 text-left font-medium">
                      溫室氣體
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      排放量 (tCO2e)
                    </th>
                    <th className="px-4 py-2 text-right font-medium">佔比</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "二氧化碳 (CO2)", amount: derived.totalCo2 },
                    { name: "甲烷 (CH4)", amount: derived.totalCh4 },
                    { name: "氧化亞氮 (N2O)", amount: derived.totalN2o },
                    {
                      name: "其他 GHG (HFCs, PFCs, SF6, NF3)",
                      amount: derived.totalOther,
                    },
                  ].map((g) => (
                    <tr
                      key={g.name}
                      className="border-b last:border-b-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-2">{g.name}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {fmt(g.amount)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                        {pct(g.amount, derived.grandTotal)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 bg-muted/40">
                    <td className="px-4 py-2 font-semibold">合計</td>
                    <td className="px-4 py-2 text-right font-mono font-bold">
                      {fmt(derived.grandTotal)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      100.00%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* TCFD */}
      <Section
        title="TCFD 氣候相關財務揭露"
        subtitle="Task Force on Climate-related Financial Disclosures"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TCFDCard
            pillar="治理"
            pillarEn="Governance"
            description="董事會對氣候相關風險與機會之監督"
            items={[
              "董事會定期檢視碳排放管理進度",
              "設置永續發展委員會負責氣候議題",
              "將碳管理績效納入經營團隊考核指標",
            ]}
          />
          <TCFDCard
            pillar="策略"
            pillarEn="Strategy"
            description="氣候相關風險與機會對組織業務、策略及財務規劃之影響"
            items={[
              "評估碳定價對營運成本之潛在影響",
              "發展低碳產品及製程技術",
              "擬定淨零轉型路徑圖",
            ]}
          />
          <TCFDCard
            pillar="風險管理"
            pillarEn="Risk Management"
            description="組織如何辨識、評估及管理氣候相關風險"
            items={[
              "建立碳排放監控及預警機制",
              "定期進行碳盤查與第三方查證",
              "評估法規變動（碳費、CBAM）之衝擊",
            ]}
          />
          <TCFDCard
            pillar="指標與目標"
            pillarEn="Metrics & Targets"
            description="用以評估及管理相關氣候風險與機會之指標及目標"
            items={[
              `${periodYear} 年度排放總量: ${fmt(derived.grandTotal)} tCO2e`,
              `範疇一: ${fmt(derived.scope1)} / 範疇二: ${fmt(derived.scope2)} tCO2e`,
              reductionTargets.length > 0
                ? `減量目標: ${reductionTargets[0].targetYear} 年減量 ${reductionTargets[0].reductionPct}%`
                : "尚未設定量化減量目標",
            ]}
          />
        </div>
      </Section>

      {/* Environmental KPIs */}
      <Section title="環境績效指標" subtitle="Environmental KPIs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard
            label="年度排放總量"
            value={fmtEmission(derived.grandTotal)}
            unit="tCO2e"
          />
          <KPICard
            label="直接排放佔比"
            value={`${pct(derived.scope1, derived.grandTotal)}%`}
            unit="範疇一"
          />
          <KPICard
            label="間接排放佔比"
            value={`${pct(derived.scope2, derived.grandTotal)}%`}
            unit="範疇二"
          />
          <KPICard
            label="排放源總數"
            value={`${derived.sourceCount}`}
            unit="項"
          />
          <KPICard
            label="數據紀錄筆數"
            value={`${derived.dataCount}`}
            unit="筆"
          />
          <KPICard
            label="盤查據點數"
            value={`${derived.unitNames.length}`}
            unit="個據點"
          />
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: CBAM
// ---------------------------------------------------------------------------

function CBAMTab({
  orgName,
  orgTaxId,
  orgIndustry,
  periodYear,
  periodStart,
  periodEnd,
  derived,
}: {
  orgName: string;
  orgTaxId: string;
  orgIndustry: string;
  periodYear: number;
  periodStart: string;
  periodEnd: string;
  derived: DerivedData;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DownloadButton label="下載報告 (CBAM 申報)" />
      </div>

      {/* CBAM notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-300">
              歐盟碳邊境調整機制 (CBAM) 申報說明
            </p>
            <p className="text-blue-700 dark:text-blue-400 mt-1">
              本報告依據歐盟 CBAM 法規 (EU) 2023/956
              之要求，提供產品隱含排放量資料。
              過渡期間（2023-2025）需於每季提交 CBAM
              報告，正式實施後將依實際排放量核算碳費。
            </p>
          </div>
        </div>
      </div>

      {/* Operator info */}
      <Section
        title="安裝設施營運者資訊"
        subtitle="Installation Operator Information"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <InfoField label="營運者名稱" value={orgName} />
          <InfoField label="統一編號" value={orgTaxId} />
          <InfoField label="產業別" value={orgIndustry || "-"} />
          <InfoField
            label="報告期間"
            value={`${formatDate(periodStart)} ~ ${formatDate(periodEnd)}`}
          />
          <InfoField label="報告年度" value={`${periodYear}`} />
          <InfoField label="國家/地區" value="台灣 (TW)" />
        </div>
      </Section>

      {/* Direct + indirect emissions */}
      <Section
        title="隱含排放量"
        subtitle="Embedded Emissions"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">直接排放量</p>
              <p className="text-xl font-bold mt-1">
                {fmt(derived.scope1)}{" "}
                <span className="text-sm font-normal">tCO2e</span>
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">間接排放量</p>
              <p className="text-xl font-bold mt-1">
                {fmt(derived.scope2)}{" "}
                <span className="text-sm font-normal">tCO2e</span>
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">總隱含排放量</p>
              <p className="text-xl font-bold mt-1">
                {fmt(derived.grandTotal)}{" "}
                <span className="text-sm font-normal">tCO2e</span>
              </p>
            </div>
          </div>

          {/* Source detail table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium">排放源</th>
                  <th className="px-4 py-2.5 text-left font-medium">據點</th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    排放類型
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    活動數據
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">單位</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    排放係數
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium">
                    係數來源
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    排放量 (tCO2e)
                  </th>
                </tr>
              </thead>
              <tbody>
                {derived.sources.map((src, i) => (
                  <tr
                    key={i}
                    className="border-b last:border-b-0 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-2">{src.sourceName}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {src.unitName}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-xs">
                        {SCOPE_SHORT[src.scope] ?? src.scope}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {fmt(src.annualActivity, 2)}
                    </td>
                    <td className="px-4 py-2">{src.activityUnit}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {fmt(src.factorValue, 6)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {FACTOR_SOURCE_LABELS[src.factorSource] ??
                        src.factorSource}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {fmt(src.totalEmission)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 bg-muted/40">
                  <td
                    colSpan={7}
                    className="px-4 py-2.5 text-right font-semibold"
                  >
                    總計
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-base font-bold">
                    {fmt(derived.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Calculation methodology */}
      <Section title="計算方法論" subtitle="Calculation Methodology">
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium mb-1">排放量計算公式</p>
            <p className="text-muted-foreground font-mono text-xs">
              排放量 (tCO2e) = 活動數據量 x 排放係數
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium mb-1">排放係數來源</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {[...new Set(derived.sources.map((s) => s.factorSource))].map(
                (fs) => (
                  <Badge key={fs} variant="outline">
                    {FACTOR_SOURCE_LABELS[fs] ?? fs}
                  </Badge>
                ),
              )}
            </div>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="font-medium mb-1">數據品質</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(derived.qualityCounts).map(([q, count]) => (
                <Badge key={q} className={QUALITY_COLORS[q] ?? ""}>
                  {QUALITY_LABELS[q] ?? q}: {count} 筆
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: GHG Inventory Register
// ---------------------------------------------------------------------------

function RegisterTab({
  orgName,
  orgTaxId,
  boundaryMethod,
  periodName,
  periodYear,
  data,
  derived,
}: {
  orgName: string;
  orgTaxId: string;
  boundaryMethod: string;
  periodName: string;
  periodYear: number;
  data: ComplianceData[];
  derived: DerivedData;
}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DownloadButton label="下載報告 (盤查清冊)" />
      </div>

      {/* Organization info */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold mb-3">盤查基本資訊</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <InfoField label="組織名稱" value={orgName} />
          <InfoField label="統一編號" value={orgTaxId} />
          <InfoField
            label="邊界設定方法"
            value={BOUNDARY_LABELS[boundaryMethod] ?? boundaryMethod}
          />
          <InfoField
            label="盤查期間"
            value={`${periodName} (${periodYear})`}
          />
        </div>
      </div>

      {/* Full register table */}
      <div className="rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-base font-semibold">溫室氣體盤查清冊</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            完整排放源月度活動數據與排放量明細
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  序號
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  據點
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  排放源名稱
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  範疇
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  排放類別
                </th>
                <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">
                  月份
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  活動數據量
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  單位
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  排放係數
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  係數來源
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  CO2
                  <br />
                  (tCO2e)
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  CH4
                  <br />
                  (tCO2e)
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  N2O
                  <br />
                  (tCO2e)
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  其他 GHG
                  <br />
                  (tCO2e)
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  合計
                  <br />
                  (tCO2e)
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  數據品質
                </th>
              </tr>
            </thead>
            <tbody>
              {derived.scopeGroups.map((sg) => (
                <RegisterScopeRows
                  key={sg.scope}
                  scopeGroup={sg}
                  data={data}
                  grandTotal={derived.grandTotal}
                />
              ))}
              {/* Grand total */}
              <tr className="border-t-2 bg-muted/40">
                <td
                  colSpan={10}
                  className="px-3 py-2.5 text-right font-semibold"
                >
                  排放總量
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">
                  {fmt(derived.totalCo2)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">
                  {fmt(derived.totalCh4)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">
                  {fmt(derived.totalN2o)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold">
                  {fmt(derived.totalOther)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-sm font-bold">
                  {fmt(derived.grandTotal)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RegisterScopeRows({
  scopeGroup,
  data,
  grandTotal,
}: {
  scopeGroup: ScopeSummary;
  data: ComplianceData[];
  grandTotal: number;
}) {
  const scopeData = data.filter((d) => d.sourceScope === scopeGroup.scope);
  let idx = 0;

  return (
    <>
      {/* Scope header */}
      <tr className="border-b bg-primary/5">
        <td colSpan={16} className="px-3 py-2.5 font-semibold text-sm">
          {scopeGroup.label}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({pct(scopeGroup.total, grandTotal)}%)
          </span>
        </td>
      </tr>
      {scopeData.map((d) => {
        idx++;
        return (
          <tr
            key={`${d.unitName}-${d.sourceName}-${d.month}-${idx}`}
            className="border-b last:border-b-0 hover:bg-muted/10 transition-colors"
          >
            <td className="px-3 py-2 text-center font-mono">{idx}</td>
            <td className="px-3 py-2 whitespace-nowrap">{d.unitName}</td>
            <td className="px-3 py-2">{d.sourceName}</td>
            <td className="px-3 py-2 whitespace-nowrap">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                {SCOPE_SHORT[d.sourceScope] ?? d.sourceScope}
              </Badge>
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
              {CATEGORY_LABELS[d.sourceCategory] ?? d.sourceCategory}
            </td>
            <td className="px-3 py-2 text-center font-mono">{d.month}月</td>
            <td className="px-3 py-2 text-right font-mono">
              {fmt(d.activityAmount, 2)}
            </td>
            <td className="px-3 py-2">{d.activityUnit}</td>
            <td className="px-3 py-2 text-right font-mono">
              {fmt(d.factorValue, 6)}
            </td>
            <td className="px-3 py-2 text-muted-foreground">
              {FACTOR_SOURCE_LABELS[d.factorSource] ?? d.factorSource}
            </td>
            <td className="px-3 py-2 text-right font-mono">
              {fmt(d.co2Amount)}
            </td>
            <td className="px-3 py-2 text-right font-mono">
              {fmt(d.ch4Amount)}
            </td>
            <td className="px-3 py-2 text-right font-mono">
              {fmt(d.n2oAmount)}
            </td>
            <td className="px-3 py-2 text-right font-mono">
              {fmt(d.otherGhgAmount)}
            </td>
            <td className="px-3 py-2 text-right font-mono font-semibold">
              {fmt(d.emissionAmount)}
            </td>
            <td className="px-3 py-2">
              <Badge
                className={`text-[10px] ${QUALITY_COLORS[d.dataQuality] ?? ""}`}
              >
                {QUALITY_LABELS[d.dataQuality] ?? d.dataQuality}
              </Badge>
            </td>
          </tr>
        );
      })}
      {/* Scope subtotal */}
      <tr className="border-b bg-muted/30">
        <td
          colSpan={10}
          className="px-3 py-2 text-right text-xs font-semibold"
        >
          {SCOPE_SHORT[scopeGroup.scope] ?? scopeGroup.scope} 小計
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {fmt(scopeGroup.co2)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {fmt(scopeGroup.ch4)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {fmt(scopeGroup.n2o)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-semibold text-xs">
          {fmt(scopeGroup.other)}
        </td>
        <td className="px-3 py-2 text-right font-mono font-bold text-xs">
          {fmt(scopeGroup.total)}
        </td>
        <td />
      </tr>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}：</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function GhgCard({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold mt-1">{fmt(value)}</p>
      <p className="text-xs text-muted-foreground">{pct(value, total)}%</p>
    </div>
  );
}

function MetricCard({
  code,
  label,
  value,
  detail,
}: {
  code: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-mono">
          {code}
        </Badge>
      </div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xl font-bold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}

function TCFDCard({
  pillar,
  pillarEn,
  description,
  items,
}: {
  pillar: string;
  pillarEn: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">
          {pillar}{" "}
          <span className="text-xs text-muted-foreground font-normal">
            ({pillarEn})
          </span>
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KPICard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{unit}</p>
    </div>
  );
}
