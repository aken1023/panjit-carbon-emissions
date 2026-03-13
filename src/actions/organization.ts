"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type OrgUnitActionState = {
  error?: string;
  success?: boolean;
} | null;

export async function createOrganizationUnit(
  _prevState: OrgUnitActionState,
  formData: FormData
): Promise<OrgUnitActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const name = (formData.get("name") as string)?.trim();
  const type = formData.get("type") as string;
  const parentId = (formData.get("parentId") as string) || null;
  const equityShare = parseFloat(formData.get("equityShare") as string);

  if (!name) {
    return { error: "請輸入單位名稱" };
  }

  if (!type || !["SUBSIDIARY", "PLANT", "DEPARTMENT"].includes(type)) {
    return { error: "請選擇有效的單位類型" };
  }

  if (isNaN(equityShare) || equityShare < 0 || equityShare > 100) {
    return { error: "持股比例必須在 0-100 之間" };
  }

  // If parentId is provided, verify it belongs to user's org
  if (parentId) {
    const parent = await prisma.organizationUnit.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.orgId !== user.orgId) {
      return { error: "所選上層單位不屬於您的組織" };
    }
  }

  await prisma.organizationUnit.create({
    data: {
      orgId: user.orgId,
      name,
      type,
      parentId,
      equityShare,
    },
  });

  revalidatePath("/organization");
  return { success: true };
}

export async function deleteOrganizationUnit(
  _prevState: OrgUnitActionState,
  formData: FormData
): Promise<OrgUnitActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const id = formData.get("id") as string;
  if (!id) return { error: "缺少單位 ID" };

  const unit = await prisma.organizationUnit.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          emissionSources: { where: { isActive: true } },
          children: { where: { isActive: true } },
        },
      },
    },
  });

  if (!unit) return { error: "找不到此組織單位" };

  if (unit.orgId !== user.orgId) {
    return { error: "無權限刪除此組織單位" };
  }

  if (unit._count.children > 0) {
    return { error: "此單位下有子單位，請先刪除子單位" };
  }

  if (unit._count.emissionSources > 0) {
    return { error: "此單位下有排放源，請先刪除排放源" };
  }

  // Soft delete
  await prisma.organizationUnit.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/organization");
  return { success: true };
}
