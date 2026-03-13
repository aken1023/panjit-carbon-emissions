import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 新增大量測試資料用於系統測試
 * 包含：多使用者、多廠區、完整12個月活動數據、各種狀態
 */
async function main() {
  // Get existing org
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error("請先執行 seed.ts 建立基本資料");
    process.exit(1);
  }

  // Get existing period
  const period = await prisma.inventoryPeriod.findFirst({
    where: { orgId: org.id, year: 2025 },
  });
  if (!period) {
    console.error("找不到 2025 年度盤查期間");
    process.exit(1);
  }

  // --- Create additional users ---
  const dataEntry1 = await prisma.user.upsert({
    where: { email: "wang@panjit.com" },
    update: {},
    create: {
      name: "王小明",
      email: "wang@panjit.com",
      password: "test123",
      role: "DATA_ENTRY",
      orgId: org.id,
    },
  });

  const dataEntry2 = await prisma.user.upsert({
    where: { email: "chen@panjit.com" },
    update: {},
    create: {
      name: "陳美玲",
      email: "chen@panjit.com",
      password: "test123",
      role: "DATA_ENTRY",
      orgId: org.id,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: "auditor@panjit.com" },
    update: {},
    create: {
      name: "李審計",
      email: "auditor@panjit.com",
      password: "test123",
      role: "AUDITOR",
      orgId: org.id,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@panjit.com" },
    update: {},
    create: {
      name: "張檢視",
      email: "viewer@panjit.com",
      password: "test123",
      role: "VIEWER",
      orgId: org.id,
    },
  });

  // Get admin and carbon manager
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const carbonMgr = await prisma.user.findFirst({ where: { role: "CARBON_MANAGER" } });
  if (!admin || !carbonMgr) {
    console.error("找不到管理員或碳管理主管");
    process.exit(1);
  }

  // --- Get existing units, create more ---
  const hq = await prisma.organizationUnit.findFirst({
    where: { orgId: org.id, parentId: null },
  });
  if (!hq) {
    console.error("找不到台灣總部");
    process.exit(1);
  }

  let hsinchu = await prisma.organizationUnit.findFirst({
    where: { name: "新竹廠" },
  });
  let kaohsiung = await prisma.organizationUnit.findFirst({
    where: { name: "高雄廠" },
  });

  // Create additional units
  const tainan = await prisma.organizationUnit.upsert({
    where: { id: "tainan-plant" },
    update: {},
    create: {
      id: "tainan-plant",
      orgId: org.id,
      name: "台南廠",
      type: "PLANT",
      equityShare: 100,
      parentId: hq.id,
    },
  });

  const suzhou = await prisma.organizationUnit.upsert({
    where: { id: "suzhou-plant" },
    update: {},
    create: {
      id: "suzhou-plant",
      orgId: org.id,
      name: "蘇州廠",
      type: "PLANT",
      equityShare: 80,
      parentId: hq.id,
    },
  });

  // --- Create 2024 base year period ---
  const period2024 = await prisma.inventoryPeriod.upsert({
    where: { orgId_year: { orgId: org.id, year: 2024 } },
    update: {},
    create: {
      orgId: org.id,
      year: 2024,
      name: "2024 年度盤查（基準年）",
      status: "VERIFIED",
      isBaseYear: true,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
    },
  });

  // --- Get existing emission factors ---
  const factors = await prisma.emissionFactor.findMany();
  const naturalGasFactor = factors.find((f) => f.name === "天然氣");
  const dieselFactor = factors.find((f) => f.name === "柴油");
  const lpgFactor = factors.find((f) => f.name === "液化石油氣 (LPG)");
  const gasolineFactor = factors.find((f) => f.name === "車用汽油");
  const mobileDieselFactor = factors.find((f) => f.name === "車用柴油");
  const r134aFactor = factors.find((f) => f.name === "R-134a 冷媒");
  const r410aFactor = factors.find((f) => f.name === "R-410A 冷媒");
  const electricityFactor = factors.find((f) => f.name.includes("台灣電力"));

  if (!naturalGasFactor || !electricityFactor || !gasolineFactor) {
    console.error("找不到必要的排放係數");
    process.exit(1);
  }

  // --- Create additional emission factors ---
  const steamFactor = await prisma.emissionFactor.upsert({
    where: { id: "steam-factor" },
    update: {},
    create: {
      id: "steam-factor",
      source: "EPA_TW",
      name: "外購蒸汽",
      scope: 2,
      category: "PURCHASED_STEAM",
      unit: "kgCO2e/GJ",
      co2Factor: 56.1,
      ch4Factor: 0.001,
      n2oFactor: 0.001,
      hfcFactor: 0,
      pfcFactor: 0,
      sf6Factor: 0,
      nf3Factor: 0,
      totalFactor: 56.102,
      gwpSource: "IPCC_AR6",
      effectiveYear: 2024,
    },
  });

  // --- Create emission sources for all units ---
  const allUnits = [hq, hsinchu!, kaohsiung!, tainan, suzhou];

  // Sources template per unit
  const sourceTemplates = [
    { scope: 1, category: "STATIONARY_COMBUSTION", nameSuffix: "鍋爐-天然氣" },
    { scope: 1, category: "STATIONARY_COMBUSTION", nameSuffix: "備用發電機-柴油" },
    { scope: 1, category: "MOBILE_COMBUSTION", nameSuffix: "公司車-汽油" },
    { scope: 1, category: "MOBILE_COMBUSTION", nameSuffix: "貨車-柴油" },
    { scope: 1, category: "FUGITIVE", nameSuffix: "空調冷媒-R410A" },
    { scope: 1, category: "FUGITIVE", nameSuffix: "製程冷媒-R134a" },
    { scope: 2, category: "PURCHASED_ELECTRICITY", nameSuffix: "外購電力" },
    { scope: 2, category: "PURCHASED_STEAM", nameSuffix: "外購蒸汽" },
  ];

  // Map factor to source category+name
  function getFactorForSource(category: string, nameSuffix: string) {
    if (category === "STATIONARY_COMBUSTION" && nameSuffix.includes("天然氣")) return naturalGasFactor!;
    if (category === "STATIONARY_COMBUSTION" && nameSuffix.includes("柴油")) return dieselFactor!;
    if (category === "MOBILE_COMBUSTION" && nameSuffix.includes("汽油")) return gasolineFactor!;
    if (category === "MOBILE_COMBUSTION" && nameSuffix.includes("柴油")) return mobileDieselFactor!;
    if (category === "FUGITIVE" && nameSuffix.includes("R410A")) return r410aFactor!;
    if (category === "FUGITIVE" && nameSuffix.includes("R134a")) return r134aFactor!;
    if (category === "PURCHASED_ELECTRICITY") return electricityFactor!;
    if (category === "PURCHASED_STEAM") return steamFactor;
    return electricityFactor!;
  }

  // Activity data ranges per source type (realistic monthly values)
  function getMonthlyAmount(category: string, nameSuffix: string, month: number): number {
    const seasonalMultiplier = [6, 7, 8].includes(month) ? 1.3 : [12, 1, 2].includes(month) ? 0.85 : 1.0;
    const randomVariation = 0.85 + Math.random() * 0.3; // ±15% random variation

    if (category === "STATIONARY_COMBUSTION" && nameSuffix.includes("天然氣"))
      return Math.round(800 * seasonalMultiplier * randomVariation); // m3
    if (category === "STATIONARY_COMBUSTION" && nameSuffix.includes("柴油"))
      return Math.round(150 * randomVariation); // L (backup generator, less seasonal)
    if (category === "MOBILE_COMBUSTION" && nameSuffix.includes("汽油"))
      return Math.round(600 * randomVariation); // L
    if (category === "MOBILE_COMBUSTION" && nameSuffix.includes("柴油"))
      return Math.round(400 * randomVariation); // L
    if (category === "FUGITIVE" && nameSuffix.includes("R410A"))
      return Math.round(5 * seasonalMultiplier * randomVariation * 10) / 10; // kg
    if (category === "FUGITIVE" && nameSuffix.includes("R134a"))
      return Math.round(3 * seasonalMultiplier * randomVariation * 10) / 10; // kg
    if (category === "PURCHASED_ELECTRICITY")
      return Math.round(150000 * seasonalMultiplier * randomVariation); // kWh
    if (category === "PURCHASED_STEAM")
      return Math.round(20 * seasonalMultiplier * randomVariation * 10) / 10; // GJ
    return 100;
  }

  function getUnit(category: string, nameSuffix: string): string {
    if (category === "STATIONARY_COMBUSTION" && nameSuffix.includes("天然氣")) return "m3";
    if (category === "STATIONARY_COMBUSTION") return "L";
    if (category === "MOBILE_COMBUSTION") return "L";
    if (category === "FUGITIVE") return "kg";
    if (category === "PURCHASED_ELECTRICITY") return "kWh";
    if (category === "PURCHASED_STEAM") return "GJ";
    return "unit";
  }

  console.log("建立各廠區排放源...");

  // Create sources and activity data for each unit
  for (const unit of allUnits) {
    // Skip HQ if it already has sources (from original seed)
    const existingSources = await prisma.emissionSource.findMany({
      where: { unitId: unit.id },
    });

    for (const template of sourceTemplates) {
      const sourceName = `${unit.name}-${template.nameSuffix}`;

      // Check if source already exists
      const existing = existingSources.find(
        (s) => s.category === template.category && s.name.includes(template.nameSuffix.split("-")[1] || template.nameSuffix)
      );

      let source;
      if (existing) {
        source = existing;
      } else {
        source = await prisma.emissionSource.create({
          data: {
            unitId: unit.id,
            scope: template.scope,
            category: template.category,
            name: sourceName,
          },
        });
      }

      const factor = getFactorForSource(template.category, template.nameSuffix);
      if (!factor) continue;

      // Create 12 months of activity data for 2025
      console.log(`  新增 ${sourceName} 活動數據...`);
      for (let month = 1; month <= 12; month++) {
        // Check if data already exists
        const existingData = await prisma.activityData.findFirst({
          where: { periodId: period.id, sourceId: source.id, month },
        });
        if (existingData) continue;

        const activityAmount = getMonthlyAmount(template.category, template.nameSuffix, month);
        const activityUnit = getUnit(template.category, template.nameSuffix);

        // Calculate emission
        const co2Amount = (activityAmount * factor.co2Factor) / 1000;
        const ch4Amount = (activityAmount * factor.ch4Factor) / 1000;
        const n2oAmount = (activityAmount * factor.n2oFactor) / 1000;
        const otherGhgAmount =
          (activityAmount * (factor.hfcFactor + factor.pfcFactor + factor.sf6Factor + factor.nf3Factor)) / 1000;
        const emissionAmount = co2Amount + ch4Amount + n2oAmount + otherGhgAmount;

        // Assign various statuses to make the data interesting
        let status: string;
        let reviewedById: string | null = null;
        let reviewedAt: Date | null = null;
        let rejectReason = "";
        const enteredById = [admin.id, dataEntry1.id, dataEntry2.id][Math.floor(Math.random() * 3)];

        if (month <= 3) {
          // Q1: all approved
          status = "APPROVED";
          reviewedById = carbonMgr.id;
          reviewedAt = new Date(`2025-${String(month + 1).padStart(2, "0")}-05`);
        } else if (month <= 6) {
          // Q2: mix of approved and submitted
          if (month <= 5) {
            status = "APPROVED";
            reviewedById = carbonMgr.id;
            reviewedAt = new Date(`2025-${String(month + 1).padStart(2, "0")}-10`);
          } else {
            status = "SUBMITTED";
          }
        } else if (month <= 9) {
          // Q3: mix of submitted and draft
          if (month === 7) {
            status = "SUBMITTED";
          } else if (month === 8) {
            status = "DRAFT";
          } else {
            // Some rejected
            status = "REJECTED";
            reviewedById = carbonMgr.id;
            reviewedAt = new Date("2025-10-15");
            rejectReason = "活動數據異常偏高，請確認是否有誤";
          }
        } else {
          // Q4: mostly draft, some not entered (skip month 12 for some sources)
          if (month === 12 && Math.random() > 0.5) continue;
          status = "DRAFT";
        }

        const dataQuality = month <= 6 ? "PRIMARY" : month <= 9 ? "SECONDARY" : "ESTIMATED";

        await prisma.activityData.create({
          data: {
            periodId: period.id,
            sourceId: source.id,
            factorId: factor.id,
            month,
            activityAmount,
            activityUnit,
            emissionAmount,
            co2Amount,
            ch4Amount,
            n2oAmount,
            otherGhgAmount,
            dataQuality,
            evidence:
              dataQuality === "PRIMARY"
                ? `${month}月帳單/發票`
                : dataQuality === "SECONDARY"
                ? "供應商提供數據"
                : "依歷史數據推估",
            status,
            enteredById,
            reviewedById,
            reviewedAt,
            rejectReason,
          },
        });
      }

      // Also create some 2024 base year data
      for (let month = 1; month <= 12; month++) {
        const existingData = await prisma.activityData.findFirst({
          where: { periodId: period2024.id, sourceId: source.id, month },
        });
        if (existingData) continue;

        const activityAmount = Math.round(
          getMonthlyAmount(template.category, template.nameSuffix, month) * 1.05
        ); // 2024 slightly higher (5% more)
        const activityUnit = getUnit(template.category, template.nameSuffix);

        const co2Amount = (activityAmount * factor.co2Factor) / 1000;
        const ch4Amount = (activityAmount * factor.ch4Factor) / 1000;
        const n2oAmount = (activityAmount * factor.n2oFactor) / 1000;
        const otherGhgAmount =
          (activityAmount * (factor.hfcFactor + factor.pfcFactor + factor.sf6Factor + factor.nf3Factor)) / 1000;
        const emissionAmount = co2Amount + ch4Amount + n2oAmount + otherGhgAmount;

        await prisma.activityData.create({
          data: {
            periodId: period2024.id,
            sourceId: source.id,
            factorId: factor.id,
            month,
            activityAmount,
            activityUnit,
            emissionAmount,
            co2Amount,
            ch4Amount,
            n2oAmount,
            otherGhgAmount,
            dataQuality: "PRIMARY",
            evidence: `${month}月帳單/發票`,
            status: "APPROVED",
            enteredById: admin.id,
            reviewedById: carbonMgr.id,
            reviewedAt: new Date(`2024-${String(Math.min(month + 1, 12)).padStart(2, "0")}-15`),
          },
        });
      }
    }
  }

  // --- Create reduction targets ---
  console.log("建立減量目標...");
  await prisma.reductionTarget.upsert({
    where: { id: "target-2030" },
    update: {},
    create: {
      id: "target-2030",
      orgId: org.id,
      baseYear: 2024,
      targetYear: 2030,
      targetType: "ABSOLUTE",
      reductionPct: 42,
      baselineAmount: 8500,
      description: "依 SBTi 1.5°C 情境設定 2030 年減量 42% 目標",
    },
  });

  await prisma.reductionTarget.upsert({
    where: { id: "target-2050" },
    update: {},
    create: {
      id: "target-2050",
      orgId: org.id,
      baseYear: 2024,
      targetYear: 2050,
      targetType: "ABSOLUTE",
      reductionPct: 90,
      baselineAmount: 8500,
      description: "2050 年淨零目標，配合台灣氣候變遷因應法",
    },
  });

  // --- Create task assignments ---
  console.log("建立盤查任務...");
  const taskData = [
    {
      assigneeId: dataEntry1.id,
      description: "收集 Q1 (1-3月) 新竹廠外購電力數據",
      dueDate: new Date("2025-04-15"),
      status: "COMPLETED",
      completedAt: new Date("2025-04-10"),
    },
    {
      assigneeId: dataEntry1.id,
      description: "收集 Q2 (4-6月) 新竹廠外購電力數據",
      dueDate: new Date("2025-07-15"),
      status: "COMPLETED",
      completedAt: new Date("2025-07-12"),
    },
    {
      assigneeId: dataEntry2.id,
      description: "收集 Q1-Q2 高雄廠天然氣使用量",
      dueDate: new Date("2025-07-30"),
      status: "COMPLETED",
      completedAt: new Date("2025-07-28"),
    },
    {
      assigneeId: dataEntry1.id,
      description: "收集 Q3 (7-9月) 全廠區活動數據",
      dueDate: new Date("2025-10-15"),
      status: "IN_PROGRESS",
    },
    {
      assigneeId: dataEntry2.id,
      description: "更新台南廠冷媒使用紀錄",
      dueDate: new Date("2025-10-30"),
      status: "IN_PROGRESS",
    },
    {
      assigneeId: dataEntry1.id,
      description: "收集 Q4 (10-12月) 全廠區活動數據",
      dueDate: new Date("2026-01-15"),
      status: "PENDING",
    },
    {
      assigneeId: dataEntry2.id,
      description: "確認蘇州廠排放數據完整性",
      dueDate: new Date("2025-11-30"),
      status: "PENDING",
    },
    {
      assigneeId: admin.id,
      description: "年度碳盤查報告初稿",
      dueDate: new Date("2026-02-28"),
      status: "PENDING",
    },
  ];

  for (const task of taskData) {
    const existing = await prisma.taskAssignment.findFirst({
      where: {
        periodId: period.id,
        assigneeId: task.assigneeId,
        description: task.description,
      },
    });
    if (!existing) {
      await prisma.taskAssignment.create({
        data: { periodId: period.id, ...task },
      });
    }
  }

  // --- Summary ---
  const sourceCount = await prisma.emissionSource.count();
  const activityCount = await prisma.activityData.count();
  const userCount = await prisma.user.count();
  const unitCount = await prisma.organizationUnit.count();
  const taskCount = await prisma.taskAssignment.count();
  const factorCount = await prisma.emissionFactor.count();

  console.log("\n===== 測試資料建立完成 =====");
  console.log(`使用者: ${userCount}`);
  console.log(`組織單位: ${unitCount}`);
  console.log(`排放源: ${sourceCount}`);
  console.log(`排放係數: ${factorCount}`);
  console.log(`活動數據: ${activityCount}`);
  console.log(`盤查任務: ${taskCount}`);
  console.log("============================\n");

  console.log("測試帳號:");
  console.log("  admin@panjit.com / admin123 (管理員)");
  console.log("  carbon@panjit.com / carbon123 (碳管理主管)");
  console.log("  wang@panjit.com / test123 (資料填報)");
  console.log("  chen@panjit.com / test123 (資料填報)");
  console.log("  auditor@panjit.com / test123 (稽核員)");
  console.log("  viewer@panjit.com / test123 (檢視者)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
