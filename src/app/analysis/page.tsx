import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnalysisPage } from "./analysis-page";

export default async function AnalysisRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Fetch current period and all activity data with sources
  const currentPeriod = await prisma.inventoryPeriod.findFirst({
    where: { orgId: user.orgId, status: { not: "LOCKED" } },
    orderBy: { year: "desc" },
  });

  // Get all approved activity data with emission sources
  const activityData = currentPeriod
    ? await prisma.activityData.findMany({
        where: { periodId: currentPeriod.id },
        include: { source: { include: { unit: true } }, factor: true },
      })
    : [];

  // Get all emission sources
  const sources = await prisma.emissionSource.findMany({
    where: { unit: { orgId: user.orgId }, isActive: true },
    include: {
      unit: true,
      activityData: currentPeriod
        ? { where: { periodId: currentPeriod.id } }
        : false,
    },
  });

  // Serialize for client
  const serializedData = activityData.map((d) => ({
    id: d.id,
    sourceId: d.sourceId,
    sourceName: d.source.name,
    sourceCategory: d.source.category,
    sourceScope: d.source.scope,
    unitName: d.source.unit.name,
    month: d.month,
    activityAmount: d.activityAmount,
    activityUnit: d.activityUnit,
    emissionAmount: d.emissionAmount ?? 0,
    co2Amount: d.co2Amount ?? 0,
    ch4Amount: d.ch4Amount ?? 0,
    n2oAmount: d.n2oAmount ?? 0,
    otherGhgAmount: d.otherGhgAmount ?? 0,
    dataQuality: d.dataQuality,
    status: d.status,
    factorSource: d.factor?.source ?? "",
    factorUnit: d.factor?.unit ?? "",
  }));

  return (
    <AnalysisPage
      periodName={currentPeriod?.name ?? ""}
      periodYear={currentPeriod?.year ?? 0}
      data={serializedData}
    />
  );
}
