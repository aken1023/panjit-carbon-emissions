"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type InventoryActionState = {
  error?: string;
  success?: boolean;
} | null;

export async function createInventoryPeriod(
  _prevState: InventoryActionState,
  formData: FormData
): Promise<InventoryActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const year = parseInt(formData.get("year") as string);
  const name = (formData.get("name") as string)?.trim();
  const isBaseYear = formData.get("isBaseYear") === "on";

  if (!year || isNaN(year)) {
    return { error: "請輸入有效的年度" };
  }

  if (year < 2000 || year > 2100) {
    return { error: "年度必須在 2000-2100 之間" };
  }

  if (!name) {
    return { error: "請輸入盤查名稱" };
  }

  // Check for duplicate year
  const existing = await prisma.inventoryPeriod.findUnique({
    where: {
      orgId_year: {
        orgId: user.orgId,
        year,
      },
    },
  });

  if (existing) {
    return { error: `${year} 年度盤查期間已存在` };
  }

  await prisma.inventoryPeriod.create({
    data: {
      orgId: user.orgId,
      year,
      name,
      isBaseYear,
      startDate: new Date(`${year}-01-01T00:00:00Z`),
      endDate: new Date(`${year}-12-31T23:59:59Z`),
    },
  });

  revalidatePath("/inventory");
  return { success: true };
}

export async function deleteInventoryPeriod(
  _prevState: InventoryActionState,
  formData: FormData
): Promise<InventoryActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const id = formData.get("id") as string;
  if (!id) return { error: "缺少盤查期間 ID" };

  const period = await prisma.inventoryPeriod.findUnique({
    where: { id },
    include: { _count: { select: { activityData: true } } },
  });

  if (!period) return { error: "找不到此盤查期間" };

  if (period.orgId !== user.orgId) {
    return { error: "無權限刪除此盤查期間" };
  }

  if (period.status !== "OPEN") {
    return { error: "僅「進行中」狀態的盤查期間可以刪除" };
  }

  if (period._count.activityData > 0) {
    return { error: "此盤查期間已有活動數據，無法刪除" };
  }

  await prisma.inventoryPeriod.delete({ where: { id } });

  revalidatePath("/inventory");
  return { success: true };
}

// Valid status transitions (forward and rollback)
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_REVIEW"],
  IN_REVIEW: ["OPEN", "VERIFIED"],
  VERIFIED: ["IN_REVIEW", "LOCKED"],
  LOCKED: [],
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "資料填報中",
  IN_REVIEW: "審查中",
  VERIFIED: "已驗證",
  LOCKED: "已鎖定",
};

export async function updatePeriodStatus(
  _prevState: InventoryActionState,
  formData: FormData
): Promise<InventoryActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "請先登入" };

  const periodId = formData.get("periodId") as string;
  const newStatus = formData.get("newStatus") as string;

  if (!periodId || !newStatus) {
    return { error: "缺少必要參數" };
  }

  const period = await prisma.inventoryPeriod.findUnique({
    where: { id: periodId },
  });

  if (!period) return { error: "找不到此盤查期間" };
  if (period.orgId !== user.orgId) return { error: "無權限操作此盤查期間" };

  // Only ADMIN and CARBON_MANAGER can change status
  if (!["ADMIN", "CARBON_MANAGER"].includes(user.role)) {
    return { error: "僅管理員或碳管理員可變更盤查狀態" };
  }

  // Validate transition
  const allowedTransitions = VALID_TRANSITIONS[period.status] ?? [];
  if (!allowedTransitions.includes(newStatus)) {
    return {
      error: `無法從「${STATUS_LABELS[period.status]}」變更為「${STATUS_LABELS[newStatus]}」`,
    };
  }

  const oldStatus = period.status;

  await prisma.inventoryPeriod.update({
    where: { id: periodId },
    data: { status: newStatus },
  });

  // Write audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entity: "InventoryPeriod",
      entityId: periodId,
      before: JSON.stringify({ status: oldStatus }),
      after: JSON.stringify({ status: newStatus }),
    },
  });

  revalidatePath("/inventory");
  return { success: true };
}
