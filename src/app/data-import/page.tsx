import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImportPage } from "./import-page";

export default async function DataImportRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Get open periods, emission sources, and factors for validation
  const periods = await prisma.inventoryPeriod.findMany({
    where: { orgId: user.orgId, status: "OPEN" },
    orderBy: { year: "desc" },
  });

  const sources = await prisma.emissionSource.findMany({
    where: { unit: { orgId: user.orgId }, isActive: true },
    include: { unit: true },
  });

  const factors = await prisma.emissionFactor.findMany({
    where: { isActive: true },
  });

  return (
    <ImportPage
      userId={user.id}
      periods={periods.map((p) => ({ id: p.id, name: p.name, year: p.year }))}
      sources={sources.map((s) => ({
        id: s.id,
        name: s.name,
        unitName: s.unit.name,
        scope: s.scope,
        category: s.category,
      }))}
      factors={factors.map((f) => ({
        id: f.id,
        name: f.name,
        scope: f.scope,
        category: f.category,
        unit: f.unit,
        totalFactor: f.totalFactor,
      }))}
    />
  );
}
