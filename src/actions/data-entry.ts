"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateEmission } from "@/lib/emission";

export type DataEntryState = {
  error?: string;
  success?: string;
} | null;

export async function createActivityData(
  _prevState: DataEntryState,
  formData: FormData
): Promise<DataEntryState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const periodId = formData.get("periodId") as string;
  const sourceId = formData.get("sourceId") as string;
  const factorId = formData.get("factorId") as string;
  const month = parseInt(formData.get("month") as string);
  const activityAmount = parseFloat(formData.get("activityAmount") as string);
  const activityUnit = formData.get("activityUnit") as string;
  const dataQuality = formData.get("dataQuality") as string;
  const evidence = (formData.get("evidence") as string) || "";

  if (!periodId || !sourceId || !month || isNaN(activityAmount)) {
    return { error: "請填寫所有必填欄位" };
  }

  if (month < 1 || month > 12) {
    return { error: "月份必須在 1-12 之間" };
  }

  if (activityAmount <= 0) {
    return { error: "活動數據量必須大於 0" };
  }

  // Verify period is OPEN
  const period = await prisma.inventoryPeriod.findUnique({
    where: { id: periodId },
  });
  if (!period || period.status !== "OPEN") {
    return { error: "此盤查期間無法新增資料" };
  }

  // Calculate emission if factor is selected
  let emissionResult = null;
  if (factorId) {
    const factor = await prisma.emissionFactor.findUnique({
      where: { id: factorId },
    });
    if (factor) {
      emissionResult = calculateEmission({
        activityAmount,
        co2Factor: factor.co2Factor,
        ch4Factor: factor.ch4Factor,
        n2oFactor: factor.n2oFactor,
        hfcFactor: factor.hfcFactor,
        pfcFactor: factor.pfcFactor,
        sf6Factor: factor.sf6Factor,
        nf3Factor: factor.nf3Factor,
      });
    }
  }

  await prisma.activityData.create({
    data: {
      periodId,
      sourceId,
      factorId: factorId || null,
      month,
      activityAmount,
      activityUnit,
      emissionAmount: emissionResult?.totalAmount ?? null,
      co2Amount: emissionResult?.co2Amount ?? null,
      ch4Amount: emissionResult?.ch4Amount ?? null,
      n2oAmount: emissionResult?.n2oAmount ?? null,
      otherGhgAmount: emissionResult?.otherGhgAmount ?? null,
      dataQuality: dataQuality || "PRIMARY",
      evidence,
      status: "DRAFT",
      enteredById: user.id,
    },
  });

  revalidatePath("/data-entry");
  return { success: "活動數據已新增" };
}

export async function updateActivityData(
  _prevState: DataEntryState,
  formData: FormData
): Promise<DataEntryState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const id = formData.get("id") as string;
  const factorId = formData.get("factorId") as string;
  const month = parseInt(formData.get("month") as string);
  const activityAmount = parseFloat(formData.get("activityAmount") as string);
  const activityUnit = formData.get("activityUnit") as string;
  const dataQuality = formData.get("dataQuality") as string;
  const evidence = (formData.get("evidence") as string) || "";

  if (!id || !month || isNaN(activityAmount)) {
    return { error: "請填寫所有必填欄位" };
  }

  // Verify the record exists and is DRAFT
  const existing = await prisma.activityData.findUnique({
    where: { id },
  });
  if (!existing) return { error: "找不到此筆資料" };
  if (existing.status !== "DRAFT") {
    return { error: "僅草稿狀態的資料可以編輯" };
  }

  // Recalculate emission
  let emissionResult = null;
  if (factorId) {
    const factor = await prisma.emissionFactor.findUnique({
      where: { id: factorId },
    });
    if (factor) {
      emissionResult = calculateEmission({
        activityAmount,
        co2Factor: factor.co2Factor,
        ch4Factor: factor.ch4Factor,
        n2oFactor: factor.n2oFactor,
        hfcFactor: factor.hfcFactor,
        pfcFactor: factor.pfcFactor,
        sf6Factor: factor.sf6Factor,
        nf3Factor: factor.nf3Factor,
      });
    }
  }

  await prisma.activityData.update({
    where: { id },
    data: {
      factorId: factorId || null,
      month,
      activityAmount,
      activityUnit,
      emissionAmount: emissionResult?.totalAmount ?? null,
      co2Amount: emissionResult?.co2Amount ?? null,
      ch4Amount: emissionResult?.ch4Amount ?? null,
      n2oAmount: emissionResult?.n2oAmount ?? null,
      otherGhgAmount: emissionResult?.otherGhgAmount ?? null,
      dataQuality: dataQuality || "PRIMARY",
      evidence,
    },
  });

  revalidatePath("/data-entry");
  return { success: "活動數據已更新" };
}

export async function deleteActivityData(
  _prevState: DataEntryState,
  formData: FormData
): Promise<DataEntryState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const id = formData.get("id") as string;
  if (!id) return { error: "缺少資料 ID" };

  const existing = await prisma.activityData.findUnique({
    where: { id },
  });
  if (!existing) return { error: "找不到此筆資料" };
  if (existing.status !== "DRAFT") {
    return { error: "僅草稿狀態的資料可以刪除" };
  }

  await prisma.activityData.delete({ where: { id } });

  revalidatePath("/data-entry");
  return { success: "活動數據已刪除" };
}

export async function submitActivityData(
  _prevState: DataEntryState,
  formData: FormData
): Promise<DataEntryState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const id = formData.get("id") as string;
  if (!id) return { error: "缺少資料 ID" };

  const existing = await prisma.activityData.findUnique({
    where: { id },
  });
  if (!existing) return { error: "找不到此筆資料" };
  if (existing.status !== "DRAFT") {
    return { error: "僅草稿狀態的資料可以送審" };
  }
  if (!existing.factorId || existing.emissionAmount === null) {
    return { error: "請先選擇排放係數並計算排放量" };
  }

  await prisma.activityData.update({
    where: { id },
    data: { status: "SUBMITTED" },
  });

  revalidatePath("/data-entry");
  return { success: "活動數據已送審" };
}
