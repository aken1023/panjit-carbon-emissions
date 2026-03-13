"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type SourceActionState = {
  error?: string;
  success?: boolean;
} | null;

export async function createEmissionSource(
  _prevState: SourceActionState,
  formData: FormData
): Promise<SourceActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const unitId = formData.get("unitId") as string;
  const scope = parseInt(formData.get("scope") as string);
  const category = formData.get("category") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = ((formData.get("description") as string) || "").trim();

  if (!name) {
    return { error: "請輸入排放源名稱" };
  }

  if (!unitId) {
    return { error: "請選擇廠區/部門" };
  }

  if (!scope || (scope !== 1 && scope !== 2)) {
    return { error: "請選擇有效的範疇" };
  }

  if (!category) {
    return { error: "請選擇排放類別" };
  }

  // Verify unit belongs to user's org
  const unit = await prisma.organizationUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit || unit.orgId !== user.orgId) {
    return { error: "所選廠區/部門不屬於您的組織" };
  }

  await prisma.emissionSource.create({
    data: {
      unitId,
      scope,
      category,
      name,
      description,
    },
  });

  revalidatePath("/sources");
  return { success: true };
}

export async function deleteEmissionSource(
  _prevState: SourceActionState,
  formData: FormData
): Promise<SourceActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const id = formData.get("id") as string;
  if (!id) return { error: "缺少排放源 ID" };

  const source = await prisma.emissionSource.findUnique({
    where: { id },
    include: {
      unit: true,
      _count: { select: { activityData: true } },
    },
  });

  if (!source) return { error: "找不到此排放源" };

  if (source.unit.orgId !== user.orgId) {
    return { error: "無權限刪除此排放源" };
  }

  if (source._count.activityData > 0) {
    return { error: "此排放源已有活動數據，無法刪除" };
  }

  // Soft delete
  await prisma.emissionSource.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/sources");
  return { success: true };
}
