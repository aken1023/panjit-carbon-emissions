import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CompliancePage } from "./compliance-page";

export default async function ComplianceRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    include: { units: { where: { isActive: true } } },
  });

  const periods = await prisma.inventoryPeriod.findMany({
    where: { orgId: user.orgId },
    orderBy: { year: "desc" },
  });

  // Get latest period data
  const latestPeriod = periods[0];
  const activityData = latestPeriod
    ? await prisma.activityData.findMany({
        where: { periodId: latestPeriod.id, status: "APPROVED" },
        include: {
          source: { include: { unit: true } },
          factor: true,
        },
      })
    : [];

  const reductionTargets = await prisma.reductionTarget.findMany({
    where: { orgId: user.orgId },
  });

  // Serialize data
  const serializedData = activityData.map((d) => ({
    sourceName: d.source.name,
    sourceCategory: d.source.category,
    sourceScope: `SCOPE_${d.source.scope}`,
    unitName: d.source.unit.name,
    month: d.month,
    activityAmount: d.activityAmount,
    activityUnit: d.activityUnit,
    emissionAmount: d.emissionAmount ?? 0,
    co2Amount: d.co2Amount ?? 0,
    ch4Amount: d.ch4Amount ?? 0,
    n2oAmount: d.n2oAmount ?? 0,
    otherGhgAmount: d.otherGhgAmount ?? 0,
    factorName: d.factor?.name ?? "",
    factorValue: d.factor?.totalFactor ?? 0,
    factorUnit: d.factor?.unit ?? "",
    factorSource: d.factor?.source ?? "",
    dataQuality: d.dataQuality,
  }));

  return (
    <CompliancePage
      orgName={org?.name ?? ""}
      orgTaxId={org?.taxId ?? ""}
      orgIndustry={org?.industry ?? ""}
      boundaryMethod={org?.boundaryMethod ?? ""}
      unitCount={org?.units.length ?? 0}
      periodName={latestPeriod?.name ?? ""}
      periodYear={latestPeriod?.year ?? 0}
      periodStart={latestPeriod?.startDate.toISOString() ?? ""}
      periodEnd={latestPeriod?.endDate.toISOString() ?? ""}
      data={serializedData}
      reductionTargets={reductionTargets.map((t) => ({
        baseYear: t.baseYear,
        targetYear: t.targetYear,
        targetType: t.targetType,
        reductionPct: t.reductionPct,
        baselineAmount: t.baselineAmount,
      }))}
    />
  );
}
