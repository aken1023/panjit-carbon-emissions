import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create organization
  const org = await prisma.organization.upsert({
    where: { taxId: "22099131" },
    update: {},
    create: {
      name: "強茂科技股份有限公司",
      taxId: "22099131",
      industry: "半導體",
      boundaryMethod: "OPERATIONAL_CONTROL",
    },
  });

  // Create admin user
  await prisma.user.upsert({
    where: { email: "admin@panjit.com" },
    update: {},
    create: {
      name: "系統管理員",
      email: "admin@panjit.com",
      password: "admin123",
      role: "ADMIN",
      orgId: org.id,
    },
  });

  // Create carbon manager
  await prisma.user.upsert({
    where: { email: "carbon@panjit.com" },
    update: {},
    create: {
      name: "碳管理主管",
      email: "carbon@panjit.com",
      password: "carbon123",
      role: "CARBON_MANAGER",
      orgId: org.id,
    },
  });

  // Create organization units
  const hq = await prisma.organizationUnit.create({
    data: { orgId: org.id, name: "台灣總部", type: "PLANT", equityShare: 100 },
  });

  await prisma.organizationUnit.create({
    data: { orgId: org.id, name: "新竹廠", type: "PLANT", equityShare: 100, parentId: hq.id },
  });

  await prisma.organizationUnit.create({
    data: { orgId: org.id, name: "高雄廠", type: "PLANT", equityShare: 100, parentId: hq.id },
  });

  // Create Taiwan EPA emission factors (2024)
  const factors = [
    // Scope 1 - Stationary combustion
    {
      source: "EPA_TW",
      name: "天然氣",
      scope: 1,
      category: "STATIONARY_COMBUSTION",
      unit: "kgCO2e/m3",
      co2Factor: 2.09,
      ch4Factor: 0.0001,
      n2oFactor: 0.0001,
      totalFactor: 2.0902,
      effectiveYear: 2024,
    },
    {
      source: "EPA_TW",
      name: "柴油",
      scope: 1,
      category: "STATIONARY_COMBUSTION",
      unit: "kgCO2e/L",
      co2Factor: 2.61,
      ch4Factor: 0.0001,
      n2oFactor: 0.0001,
      totalFactor: 2.6102,
      effectiveYear: 2024,
    },
    {
      source: "EPA_TW",
      name: "液化石油氣 (LPG)",
      scope: 1,
      category: "STATIONARY_COMBUSTION",
      unit: "kgCO2e/kg",
      co2Factor: 3.00,
      ch4Factor: 0.0001,
      n2oFactor: 0.0001,
      totalFactor: 3.0002,
      effectiveYear: 2024,
    },
    // Scope 1 - Mobile combustion
    {
      source: "EPA_TW",
      name: "車用汽油",
      scope: 1,
      category: "MOBILE_COMBUSTION",
      unit: "kgCO2e/L",
      co2Factor: 2.26,
      ch4Factor: 0.0001,
      n2oFactor: 0.0001,
      totalFactor: 2.2602,
      effectiveYear: 2024,
    },
    {
      source: "EPA_TW",
      name: "車用柴油",
      scope: 1,
      category: "MOBILE_COMBUSTION",
      unit: "kgCO2e/L",
      co2Factor: 2.61,
      ch4Factor: 0.0001,
      n2oFactor: 0.0001,
      totalFactor: 2.6102,
      effectiveYear: 2024,
    },
    // Scope 1 - Fugitive
    {
      source: "EPA_TW",
      name: "R-134a 冷媒",
      scope: 1,
      category: "FUGITIVE",
      unit: "kgCO2e/kg",
      co2Factor: 0,
      ch4Factor: 0,
      n2oFactor: 0,
      hfcFactor: 1430,
      totalFactor: 1430,
      effectiveYear: 2024,
    },
    {
      source: "EPA_TW",
      name: "R-410A 冷媒",
      scope: 1,
      category: "FUGITIVE",
      unit: "kgCO2e/kg",
      co2Factor: 0,
      ch4Factor: 0,
      n2oFactor: 0,
      hfcFactor: 2088,
      totalFactor: 2088,
      effectiveYear: 2024,
    },
    // Scope 2 - Purchased electricity (Taiwan Power Company)
    {
      source: "EPA_TW",
      name: "台灣電力公司電力（位置基礎）",
      scope: 2,
      category: "PURCHASED_ELECTRICITY",
      unit: "kgCO2e/kWh",
      co2Factor: 0.494,
      ch4Factor: 0.00001,
      n2oFactor: 0.00001,
      totalFactor: 0.49402,
      effectiveYear: 2024,
    },
  ];

  for (const factor of factors) {
    await prisma.emissionFactor.create({
      data: {
        ...factor,
        hfcFactor: factor.hfcFactor ?? 0,
        pfcFactor: 0,
        sf6Factor: 0,
        nf3Factor: 0,
        gwpSource: "IPCC_AR6",
      },
    });
  }

  // Create inventory period for 2025
  await prisma.inventoryPeriod.create({
    data: {
      orgId: org.id,
      year: 2025,
      name: "2025 年度盤查",
      status: "OPEN",
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
    },
  });

  // Create emission sources for HQ
  const sourcesList = [
    { unitId: hq.id, scope: 1, category: "STATIONARY_COMBUSTION", name: "總部鍋爐-天然氣" },
    { unitId: hq.id, scope: 1, category: "MOBILE_COMBUSTION", name: "公司車-汽油" },
    { unitId: hq.id, scope: 1, category: "FUGITIVE", name: "空調冷媒-R410A" },
    { unitId: hq.id, scope: 2, category: "PURCHASED_ELECTRICITY", name: "總部外購電力" },
  ];

  for (const source of sourcesList) {
    await prisma.emissionSource.create({ data: source });
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
