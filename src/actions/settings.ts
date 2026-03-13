"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type SettingsState = {
  error?: string;
  success?: string;
} | null;

export async function createUser(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "請先登入" };
  if (currentUser.role !== "ADMIN") return { error: "僅系統管理員可新增使用者" };

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  if (!name || !email || !password || !role) {
    return { error: "請填寫所有必填欄位" };
  }

  const validRoles = ["ADMIN", "CARBON_MANAGER", "DATA_ENTRY", "AUDITOR", "VIEWER"];
  if (!validRoles.includes(role)) {
    return { error: "無效的角色" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "此電子郵件已被使用" };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password,
      role,
      orgId: currentUser.orgId,
    },
  });

  revalidatePath("/settings");
  return { success: `使用者「${name}」已新增` };
}

export async function deleteUser(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "請先登入" };
  if (currentUser.role !== "ADMIN") return { error: "僅系統管理員可刪除使用者" };

  const userId = formData.get("userId") as string;
  if (!userId) return { error: "缺少使用者 ID" };

  if (userId === currentUser.id) {
    return { error: "無法刪除自己的帳號" };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "找不到此使用者" };
  if (target.orgId !== currentUser.orgId) {
    return { error: "無法刪除其他組織的使用者" };
  }

  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/settings");
  return { success: `使用者「${target.name}」已刪除` };
}

export async function createEmissionFactor(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "請先登入" };

  const name = formData.get("name") as string;
  const scope = parseInt(formData.get("scope") as string);
  const category = formData.get("category") as string;
  const unit = formData.get("unit") as string;
  const effectiveYear = parseInt(formData.get("effectiveYear") as string);

  if (!name || isNaN(scope) || !category || !unit || isNaN(effectiveYear)) {
    return { error: "請填寫所有必填欄位" };
  }

  const co2Factor = parseFloat(formData.get("co2Factor") as string) || 0;
  const ch4Factor = parseFloat(formData.get("ch4Factor") as string) || 0;
  const n2oFactor = parseFloat(formData.get("n2oFactor") as string) || 0;
  const hfcFactor = parseFloat(formData.get("hfcFactor") as string) || 0;
  const pfcFactor = parseFloat(formData.get("pfcFactor") as string) || 0;
  const sf6Factor = parseFloat(formData.get("sf6Factor") as string) || 0;
  const nf3Factor = parseFloat(formData.get("nf3Factor") as string) || 0;

  const totalFactor =
    co2Factor + ch4Factor + n2oFactor + hfcFactor + pfcFactor + sf6Factor + nf3Factor;

  await prisma.emissionFactor.create({
    data: {
      source: "CUSTOM",
      name,
      scope,
      category,
      unit,
      co2Factor,
      ch4Factor,
      n2oFactor,
      hfcFactor,
      pfcFactor,
      sf6Factor,
      nf3Factor,
      totalFactor,
      effectiveYear,
    },
  });

  revalidatePath("/settings");
  return { success: `排放係數「${name}」已新增` };
}
