"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateEmission } from "@/lib/emission";
import { revalidatePath } from "next/cache";

export interface ImportRow {
  sourceName: string;
  month: number;
  activityAmount: number;
  activityUnit: string;
  dataQuality: string;
}

export interface ImportResult {
  imported: number;
  errors: string[];
  total: number;
  error?: string;
}

export async function batchImportActivityData(
  periodId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (!user) return { imported: 0, errors: [], total: 0, error: "未登入" };

  // Validate period belongs to user's org and is open
  const period = await prisma.inventoryPeriod.findFirst({
    where: { id: periodId, orgId: user.orgId, status: "OPEN" },
  });
  if (!period)
    return {
      imported: 0,
      errors: [],
      total: rows.length,
      error: "盤查期間無效或已鎖定",
    };

  // Get all sources for matching
  const sources = await prisma.emissionSource.findMany({
    where: { unit: { orgId: user.orgId }, isActive: true },
  });
  const sourceMap = new Map(sources.map((s) => [s.name, s]));

  // Get factors for auto-calculation
  const factors = await prisma.emissionFactor.findMany({
    where: { isActive: true },
  });

  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const source = sourceMap.get(row.sourceName);
    if (!source) {
      errors.push(`第 ${rowNum} 列：排放源「${row.sourceName}」不存在`);
      continue;
    }

    if (row.month < 1 || row.month > 12) {
      errors.push(`第 ${rowNum} 列：月份 ${row.month} 無效，須為 1-12`);
      continue;
    }

    if (!row.activityAmount || row.activityAmount <= 0) {
      errors.push(`第 ${rowNum} 列：活動數據量必須大於 0`);
      continue;
    }

    // Find matching factor by scope + category
    const factor = factors.find(
      (f) => f.scope === source.scope && f.category === source.category
    );

    // Calculate emission if factor found
    let emissionResult = null;
    if (factor) {
      emissionResult = calculateEmission({
        activityAmount: row.activityAmount,
        co2Factor: factor.co2Factor,
        ch4Factor: factor.ch4Factor,
        n2oFactor: factor.n2oFactor,
        hfcFactor: factor.hfcFactor,
        pfcFactor: factor.pfcFactor,
        sf6Factor: factor.sf6Factor,
        nf3Factor: factor.nf3Factor,
      });
    }

    await prisma.activityData.create({
      data: {
        periodId,
        sourceId: source.id,
        factorId: factor?.id ?? null,
        month: row.month,
        activityAmount: row.activityAmount,
        activityUnit: row.activityUnit,
        emissionAmount: emissionResult?.totalAmount ?? null,
        co2Amount: emissionResult?.co2Amount ?? null,
        ch4Amount: emissionResult?.ch4Amount ?? null,
        n2oAmount: emissionResult?.n2oAmount ?? null,
        otherGhgAmount: emissionResult?.otherGhgAmount ?? null,
        dataQuality: row.dataQuality || "SECONDARY",
        status: "DRAFT",
        enteredById: user.id,
      },
    });
    imported++;
  }

  revalidatePath("/data-entry");
  revalidatePath("/data-import");
  return { imported, errors, total: rows.length };
}
