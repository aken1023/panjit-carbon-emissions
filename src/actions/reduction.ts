"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function createTarget(_prevState: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const baseYear = parseInt(formData.get("baseYear") as string);
  const targetYear = parseInt(formData.get("targetYear") as string);
  const targetType = formData.get("targetType") as string;
  const reductionPct = parseFloat(formData.get("reductionPct") as string);
  const baselineAmount = parseFloat(formData.get("baselineAmount") as string);
  const description = (formData.get("description") as string) || "";

  if (!baseYear || !targetYear || !reductionPct || !baselineAmount) {
    return { error: "請填寫所有必填欄位" };
  }

  if (targetYear <= baseYear) {
    return { error: "目標年必須大於基準年" };
  }

  if (reductionPct <= 0 || reductionPct > 100) {
    return { error: "減碳百分比必須在 0 到 100 之間" };
  }

  if (baselineAmount <= 0) {
    return { error: "基準年排放量必須大於 0" };
  }

  if (!["ABSOLUTE", "INTENSITY"].includes(targetType)) {
    return { error: "無效的減碳類型" };
  }

  await prisma.reductionTarget.create({
    data: {
      orgId: user.orgId,
      baseYear,
      targetYear,
      targetType,
      reductionPct,
      baselineAmount,
      description,
    },
  });

  revalidatePath("/reduction");
  return { success: true };
}

export async function deleteTarget(_prevState: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const id = formData.get("id") as string;
  if (!id) return { error: "缺少目標 ID" };

  // Verify ownership
  const target = await prisma.reductionTarget.findUnique({ where: { id } });
  if (!target || target.orgId !== user.orgId) {
    return { error: "找不到該減碳目標" };
  }

  await prisma.reductionTarget.delete({ where: { id } });

  revalidatePath("/reduction");
  return { success: true };
}
