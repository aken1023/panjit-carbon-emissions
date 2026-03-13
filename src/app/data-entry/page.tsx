import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DataEntryTable } from "./data-entry-table";
import { PeriodSelector } from "./period-selector";

export default async function DataEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ periodId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  // Fetch OPEN periods for this org
  const periods = await prisma.inventoryPeriod.findMany({
    where: {
      orgId: user.orgId,
      status: "OPEN",
    },
    orderBy: { year: "desc" },
  });

  const selectedPeriodId = params.periodId || periods[0]?.id || null;

  // Fetch data for selected period
  let activityData: Array<{
    id: string;
    month: number;
    activityAmount: number;
    activityUnit: string;
    emissionAmount: number | null;
    dataQuality: string;
    evidence: string;
    status: string;
    source: { id: string; name: string; scope: number; category: string };
    factor: { id: string; name: string } | null;
  }> = [];

  if (selectedPeriodId) {
    activityData = await prisma.activityData.findMany({
      where: { periodId: selectedPeriodId },
      include: {
        source: { select: { id: true, name: true, scope: true, category: true } },
        factor: { select: { id: true, name: true } },
      },
      orderBy: [{ month: "asc" }, { source: { scope: "asc" } }],
    });
  }

  // Fetch emission sources for the org
  const sources = await prisma.emissionSource.findMany({
    where: {
      unit: { orgId: user.orgId },
      isActive: true,
    },
    select: { id: true, name: true, scope: true, category: true },
    orderBy: [{ scope: "asc" }, { category: "asc" }],
  });

  // Fetch all active emission factors
  const factors = await prisma.emissionFactor.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      scope: true,
      category: true,
      unit: true,
      totalFactor: true,
    },
    orderBy: [{ scope: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">資料填報</h1>
        <p className="text-muted-foreground">填報各排放源的活動數據</p>
      </div>

      {periods.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚無開放的盤查期間
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先建立盤查期間，並確認狀態為「開放」
          </p>
        </div>
      ) : (
        <>
          <PeriodSelector
            periods={periods.map((p) => ({
              id: p.id,
              name: p.name,
              year: p.year,
            }))}
            selectedPeriodId={selectedPeriodId!}
          />

          {selectedPeriodId && (
            <DataEntryTable
              periodId={selectedPeriodId}
              data={activityData}
              sources={sources}
              factors={factors}
            />
          )}
        </>
      )}
    </div>
  );
}
