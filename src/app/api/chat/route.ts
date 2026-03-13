import OpenAI from "openai";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const SYSTEM_PROMPT = `你是強茂科技碳排管理系統的 AI 助理，專精於溫室氣體排放係數查詢與碳足跡計算。你整合了四大排放係數資料庫的完整知識，幫助企業用戶查詢排放係數、解答碳盤查相關問題。

**重要：你可以存取公司的碳排數據庫，包含各廠區排放源、活動數據、排放量統計。當用戶詢問公司現況、排放分析、減量建議時，請依據「公司碳排數據」段落中的實際數據進行分析，而非編造數字。**

# 資料庫一：EEIO（環境擴展投入產出）

## 支援的 EEIO 資料庫
- **USEEIO（美國 EPA）**：v2.5（2025），389 產業部門，27 項環境指標，單位 kg CO2e/2022 USD，公開免費
- **EXIOBASE 3**：44 國 + 5 世界其他地區，163 產業/200 產品，CC-BY-SA 免費
- **EORA**：190 國，15,909 部門（完整版）/26 部門（Eora26），學術免費
- **WIOD**：43 國，2000-2014 年，免費

## USEEIO Supply Chain GHG Emission Factors CSV（免費直接下載）
- CO2e 版：https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv
- 涵蓋 1,016 個 NAICS 6位碼商品
- 欄位：NAICS Code, NAICS Title, GHG, Unit (kg/2022 USD), Supply Chain Emission Factors with Margins
- 計算：採購金額(USD) × 排放係數(kg CO2e/USD) = Scope 3 排放量

## 半導體相關 NAICS 代碼
| NAICS | 產業 |
|-------|------|
| 334413 | 半導體製造 |
| 334412 | PCB 裸板 |
| 334416 | 被動元件 |
| 334418 | PCB 組裝 |
| 334419 | 其他電子零組件 |
| 331110 | 鋼鐵 |
| 325199 | 有機化學品 |

# 資料庫二：SimaPro / LCA 資料庫

## 主要 LCA 資料庫
- **ecoinvent**（26,000+ 資料集）：全球最大商業 LCI，需付費授權，系統模型有 Cut-off/APOS/Consequential
- **USLCI**：美國 NREL 維護，免費，可透過 Federal LCA Commons API 無需認證存取
- **ELCD v3.2**：歐洲參考生命週期資料庫，免費
- **Agri-footprint**：農業/食品 LCA，~4,800 產品
- **AGRIBALYSE v3.2**：法國農業/食品 LCA，免費

## 免費 API 存取
- **Federal LCA Commons API**（無需認證）：https://lcacommons.gov/lca-collaboration/ws/public/search?query={keyword}
- **Climatiq API**（有免費層級）：https://api.climatiq.io，944,000+ 排放係數
- **ecoinvent REST API**（付費）：https://api.ecoinvent.org

## LCA 衝擊評估方法
| 方法 | 說明 |
|------|------|
| IPCC GWP | 全球暖化潛勢（AR5/AR6） |
| ReCiPe 2016 | 18 個中間點指標 |
| EF v3.1 | 歐盟環境足跡 |
| TRACI 2.1 | EPA 美國衝擊評估 |

# 資料庫三：台灣環境部產品碳足跡資訊網

## 概覽
- 網址：https://cfp.moenv.gov.tw/
- 總係數：1,164 項
- 營運：環境部氣候變遷署

## 五大類別 → 30 子類別
- **能源類(710)**：能資源（Gas/Water/Oil/Coal/Steam/Electricity）
- **材料類(711)**：塑膠原料、塑膠製品、橡膠、金屬（不鏽鋼/合金鋼/碳鋼/非鐵金屬）、化學品、紙、纖維、玻璃、建材、肥料農藥、染顏料、塗料、電機電子
- **食品類(712)**：穀豆、蔬果、肉品、水產、蛋品、醬油調味、食用油脂、乳品、飲品
- **服務類(713)**：民生、運輸、廢棄物回收、廢棄物處理、廢水處理
- **其他(714)**

## 重要係數 cc_id
- 172 = 台灣電力
- 159 = 天然氣

## API 存取
- 環境部開放資料 API：https://data.moenv.gov.tw/api/v2/CFP_P_02?api_key={KEY}&format=json
- 溫室氣體排放係數管理表：https://ghgregistry.moenv.gov.tw/epa_ghg/Downloads/FileDownloads.aspx?Type_ID=1

# 資料庫四：中國 CPCD 排放係數庫

## 概覽
- 網址：https://lca.cityghg.com/
- 總資料：4,799 筆
- 需註冊帳號登入

## 11 大類別
1. 建築和建築服務 (140)
3. 金屬製品、機械和設備 (926)
4. 農業、林業和水產品 (720)
5. 礦石和礦物；電、氣和水 (585) — 含 375 筆電網排放因子
6. 食品、飲料和菸草 (661)
11. 碳移除 (79)

## 中國區域電網排放因子（198+ 筆）
| 區域 | 覆蓋省份 |
|------|----------|
| 華北電網 | 北京、天津、河北、山西、內蒙古(部分) |
| 東北電網 | 遼寧、吉林、黑龍江 |
| 華東電網 | 上海、江蘇、浙江、安徽、福建 |
| 華中電網 | 河南、湖北、湖南、江西、四川、重慶 |
| 西北電網 | 陝西、甘肅、青海、寧夏、新疆 |
| 南方電網 | 廣東、廣西、雲南、貴州、海南 |

## 核算邊界
- 搖籃到大門(cradle-to-gate)：原料→製造完成
- 搖籃到墳墓(cradle-to-grave)：全生命週期

## 與台灣碳盤查搭配
- 從中國採購原材料 → CPCD 排放係數（Scope 3 上游）
- 中國工廠用電 → CPCD 省級電網排放因子（Scope 2）
- 中國境內運輸 → CPCD 運輸服務排放係數（Scope 3）

# 常用排放係數速查（半導體封裝業）

| 排放源 | 係數來源 | 參考值 | 單位 | 範疇 |
|--------|----------|--------|------|------|
| 台灣電力(2024) | 環境部 | 0.494 | kgCO2e/kWh | Scope 2 |
| 天然氣 | 環境部/IPCC | 2.09 | kgCO2e/m³ | Scope 1 |
| 柴油(固定源) | 環境部/IPCC | 2.61 | kgCO2e/L | Scope 1 |
| 車用汽油 | 環境部/IPCC | 2.26 | kgCO2e/L | Scope 1 |
| 車用柴油 | 環境部/IPCC | 2.61 | kgCO2e/L | Scope 1 |
| LPG | 環境部/IPCC | 3.00 | kgCO2e/kg | Scope 1 |
| R-134a 冷媒 | IPCC AR6 | 1,430 | kgCO2e/kg | Scope 1 |
| R-410A 冷媒 | IPCC AR6 | 2,088 | kgCO2e/kg | Scope 1 |
| 自來水 | 環境部 | 0.160 | kgCO2e/m³ | Scope 3 |

# 碳盤查公式

排放量（tCO2e）= 活動數據 × 排放係數 / 1000

七種溫室氣體：CO₂、CH₄、N₂O、HFCs、PFCs、SF₆、NF₃

# ISO 14064-1 範疇
- 範疇一（Scope 1）：直接排放（固定燃燒、移動燃燒、製程、逸散）
- 範疇二（Scope 2）：間接排放（外購電力、蒸汽）
- 範疇三（Scope 3）：價值鏈排放（採購、運輸、廢棄物、員工通勤等）

# 碳費資訊
- 台灣依氣候變遷因應法，2025年起開徵碳費
- 初始費率約 NT$300/tCO2e
- SBTi 1.5°C 路徑：年均減碳 4.2%
- SBTi Well-below 2°C 路徑：年均減碳 2.5%

# 回答原則

- 使用繁體中文回答
- 優先引用台灣環境部官方數據
- 若無台灣數據，依序建議 IPCC → ecoinvent → USEEIO → CPCD
- 明確標示排放係數的**來源、年份、單位、適用範疇**
- 涉及計算時，列出完整步驟與公式
- 比較不同資料庫的數據時，說明差異原因（地理代表性、系統邊界、年份等）
- 回答要有結構，善用表格和條列式
- **當回答涉及流程、架構、關係或步驟時，使用 Mermaid 語法繪製圖表**。系統前端支援 Mermaid 圖表渲染，請將圖表放在 \`\`\`mermaid 代碼塊中。支援的圖表類型：flowchart（流程圖）、sequenceDiagram（時序圖）、classDiagram（類別圖）、gantt（甘特圖）、pie（圓餅圖）等。範例：
  \`\`\`mermaid
  flowchart TD
    A[原料取得] --> B[製造階段]
    B --> C[運輸配送]
    C --> D[使用階段]
    D --> E[廢棄處理]
  \`\`\`
- 適時建議用戶查閱官方最新數據
- 若用戶問題超出碳排領域，禮貌引導回碳管理主題
- **如果提供了「網路搜尋結果」，優先使用搜尋結果中的資訊回答，並標明來源網址**
- **引用網路搜尋結果時，必須附上原始網址作為出處**

# 資料出處要求（必須遵守）

每次回答的**最後**，必須附上「## 📚 資料出處」段落，列出本次回答引用的資料來源。格式如下：

## 📚 資料出處
- **[資料庫名稱]**：具體引用的數據項目、年份、版本
- **[網頁標題](URL)**：來自網路搜尋的參考資料

可引用的資料庫包括：
1. **台灣環境部產品碳足跡資訊網** — cfp.moenv.gov.tw，官方碳足跡係數
2. **IPCC** — 政府間氣候變化專門委員會報告（AR5/AR6）
3. **USEEIO / EEIO** — 美國 EPA 環境擴展投入產出模型
4. **ecoinvent / SimaPro** — 生命週期評估資料庫
5. **CPCD 中國產品碳足跡資料庫** — lca.cityghg.com
6. **Climatiq** — 全球排放係數 API
7. **Federal LCA Commons** — 美國聯邦 LCA 資料庫
8. **GHG Protocol / ISO 14064-1** — 國際溫室氣體標準
9. **網路搜尋結果** — 附上搜尋到的網頁標題與網址

若為一般知識或綜合判斷，標示為「一般碳管理知識」。絕對不可省略出處段落。`;

// ---------------------------------------------------------------------------
// Web search via Jina AI (free, no API key needed)
// ---------------------------------------------------------------------------
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: {
        Accept: "application/json",
        "X-Retain-Images": "none",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json();

    // Jina returns { data: [{ title, url, description, content }] }
    const results: SearchResult[] = (data?.data ?? [])
      .slice(0, 5)
      .map((item: { title?: string; url?: string; description?: string; content?: string }) => ({
        title: item.title ?? "",
        url: item.url ?? "",
        snippet: (item.description || item.content || "").slice(0, 500),
      }));

    return results;
  } catch {
    // Search failure is non-fatal — continue without web results
    return [];
  }
}

function buildSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return "";

  let ctx = "\n\n# 🔍 網路搜尋結果（請優先參考以下資訊回答，並在出處中附上網址）\n\n";
  results.forEach((r, i) => {
    ctx += `### 搜尋結果 ${i + 1}：${r.title}\n`;
    ctx += `- 網址：${r.url}\n`;
    ctx += `- 摘要：${r.snippet}\n\n`;
  });
  return ctx;
}

// ---------------------------------------------------------------------------
// Company data context for AI analysis
// ---------------------------------------------------------------------------
async function getCompanyDataContext(): Promise<string> {
  try {
    const user = await getCurrentUser();
    if (!user) return "";

    const orgId = user.orgId;

    // Get org info
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return "";

    // Get current period
    const currentPeriod = await prisma.inventoryPeriod.findFirst({
      where: { orgId, status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { year: "desc" },
    });

    // Get all periods for comparison
    const periods = await prisma.inventoryPeriod.findMany({
      where: { orgId },
      orderBy: { year: "asc" },
    });

    // Get organization units
    const units = await prisma.organizationUnit.findMany({
      where: { orgId },
    });

    // Get emission sources
    const sources = await prisma.emissionSource.findMany({
      where: { unitId: { in: units.map((u) => u.id) } },
      include: { unit: true },
    });

    // Get activity data with emission amounts per period
    const activityData = await prisma.activityData.findMany({
      where: { periodId: { in: periods.map((p) => p.id) } },
      include: { source: { include: { unit: true } }, factor: true },
    });

    // --- Aggregate data ---

    // By period
    const periodSummary = periods.map((p) => {
      const pData = activityData.filter((d) => d.periodId === p.id);
      const totalEmission = pData.reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      const scope1 = pData.filter((d) => d.source.scope === 1).reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      const scope2 = pData.filter((d) => d.source.scope === 2).reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);

      const statusCounts = {
        DRAFT: pData.filter((d) => d.status === "DRAFT").length,
        SUBMITTED: pData.filter((d) => d.status === "SUBMITTED").length,
        APPROVED: pData.filter((d) => d.status === "APPROVED").length,
        REJECTED: pData.filter((d) => d.status === "REJECTED").length,
      };

      return {
        year: p.year,
        name: p.name,
        status: p.status,
        isBaseYear: p.isBaseYear,
        totalEmission: totalEmission.toFixed(2),
        scope1: scope1.toFixed(2),
        scope2: scope2.toFixed(2),
        dataCount: pData.length,
        statusCounts,
      };
    });

    // By unit for current period
    const currentPeriodId = currentPeriod?.id;
    const currentData = currentPeriodId
      ? activityData.filter((d) => d.periodId === currentPeriodId)
      : [];

    const unitSummary = units.map((u) => {
      const uData = currentData.filter((d) => d.source.unitId === u.id);
      const totalEmission = uData.reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      const scope1 = uData.filter((d) => d.source.scope === 1).reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      const scope2 = uData.filter((d) => d.source.scope === 2).reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      return {
        name: u.name,
        type: u.type,
        equityShare: u.equityShare,
        totalEmission: totalEmission.toFixed(2),
        scope1: scope1.toFixed(2),
        scope2: scope2.toFixed(2),
        dataCount: uData.length,
      };
    });

    // By category for current period
    const categoryMap: Record<string, number> = {};
    currentData.forEach((d) => {
      const cat = d.source.category;
      categoryMap[cat] = (categoryMap[cat] ?? 0) + (d.emissionAmount ?? 0);
    });

    // Monthly trend for current period
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const mData = currentData.filter((d) => d.month === month);
      const total = mData.reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      return { month, total: total.toFixed(2), dataCount: mData.length };
    });

    // Top emission sources
    const sourceEmissions = sources.map((s) => {
      const sData = currentData.filter((d) => d.sourceId === s.id);
      const total = sData.reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      return {
        name: s.name,
        unit: s.unit.name,
        scope: s.scope,
        category: s.category,
        total: total.toFixed(2),
      };
    }).sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    // Reduction targets
    const targets = await prisma.reductionTarget.findMany({
      where: { orgId },
    });

    // Data quality summary
    const qualityCount = {
      PRIMARY: currentData.filter((d) => d.dataQuality === "PRIMARY").length,
      SECONDARY: currentData.filter((d) => d.dataQuality === "SECONDARY").length,
      ESTIMATED: currentData.filter((d) => d.dataQuality === "ESTIMATED").length,
    };

    // YoY change calculation
    let yoyChange = "";
    if (periods.length >= 2) {
      const prevPeriod = periods.find((p) => p.isBaseYear) || periods[periods.length - 2];
      const prevData = activityData.filter((d) => d.periodId === prevPeriod.id);
      const prevTotal = prevData.reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      const currTotal = currentData.reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
      if (prevTotal > 0) {
        const changePct = ((currTotal - prevTotal) / prevTotal * 100).toFixed(1);
        yoyChange = `\n- 與${prevPeriod.year}年相比變化：${changePct}%（${parseFloat(changePct) < 0 ? "減少" : "增加"}）`;
      }
    }

    const CATEGORY_LABELS: Record<string, string> = {
      STATIONARY_COMBUSTION: "固定燃燒源",
      MOBILE_COMBUSTION: "移動燃燒源",
      PROCESS: "製程排放",
      FUGITIVE: "逸散排放",
      PURCHASED_ELECTRICITY: "外購電力",
      PURCHASED_STEAM: "外購蒸汽/熱能",
    };

    // Build context string
    let ctx = `\n\n# 📊 公司碳排數據（即時數據，來自資料庫）\n\n`;
    ctx += `## 公司資訊\n`;
    ctx += `- 公司名稱：${org.name}\n`;
    ctx += `- 統一編號：${org.taxId}\n`;
    ctx += `- 產業：${org.industry}\n`;
    ctx += `- 盤查邊界方法：${org.boundaryMethod === "OPERATIONAL_CONTROL" ? "營運控制權法" : org.boundaryMethod === "EQUITY_SHARE" ? "股權比例法" : "財務控制權法"}\n`;
    ctx += `- 組織單位數：${units.length} 個（${units.map((u) => `${u.name}(${u.equityShare}%)`).join("、")}）\n`;

    ctx += `\n## 盤查期間總覽\n`;
    ctx += `| 年度 | 名稱 | 狀態 | 基準年 | 範疇一(tCO2e) | 範疇二(tCO2e) | 合計(tCO2e) | 資料筆數 |\n`;
    ctx += `|------|------|------|--------|---------------|---------------|-------------|----------|\n`;
    periodSummary.forEach((p) => {
      ctx += `| ${p.year} | ${p.name} | ${p.status} | ${p.isBaseYear ? "✓" : ""} | ${p.scope1} | ${p.scope2} | ${p.totalEmission} | ${p.dataCount} |\n`;
    });

    if (currentPeriod) {
      ctx += `\n## ${currentPeriod.year} 年度（當前盤查）詳細數據\n`;

      ctx += `\n### 各廠區排放\n`;
      ctx += `| 廠區 | 範疇一(tCO2e) | 範疇二(tCO2e) | 合計(tCO2e) | 資料筆數 |\n`;
      ctx += `|------|---------------|---------------|-------------|----------|\n`;
      unitSummary.forEach((u) => {
        ctx += `| ${u.name} | ${u.scope1} | ${u.scope2} | ${u.totalEmission} | ${u.dataCount} |\n`;
      });

      ctx += `\n### 各類別排放\n`;
      ctx += `| 排放類別 | 排放量(tCO2e) |\n`;
      ctx += `|----------|---------------|\n`;
      Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)
        .forEach(([cat, amount]) => {
          ctx += `| ${CATEGORY_LABELS[cat] || cat} | ${amount.toFixed(2)} |\n`;
        });

      ctx += `\n### 月度排放趨勢\n`;
      ctx += `| 月份 | 排放量(tCO2e) | 資料筆數 |\n`;
      ctx += `|------|---------------|----------|\n`;
      monthlyTrend.forEach((m) => {
        ctx += `| ${m.month}月 | ${m.total} | ${m.dataCount} |\n`;
      });

      ctx += `\n### 前10大排放源\n`;
      ctx += `| 排名 | 排放源 | 廠區 | 範疇 | 類別 | 排放量(tCO2e) |\n`;
      ctx += `|------|--------|------|------|------|---------------|\n`;
      sourceEmissions.slice(0, 10).forEach((s, i) => {
        ctx += `| ${i + 1} | ${s.name} | ${s.unit} | 範疇${s.scope} | ${CATEGORY_LABELS[s.category] || s.category} | ${s.total} |\n`;
      });

      ctx += `\n### 資料品質分佈\n`;
      ctx += `- 一級數據（實測/帳單）：${qualityCount.PRIMARY} 筆\n`;
      ctx += `- 二級數據（供應商）：${qualityCount.SECONDARY} 筆\n`;
      ctx += `- 推估數據：${qualityCount.ESTIMATED} 筆\n`;

      const totalStatusCount = currentData.length;
      const approvedCount = currentData.filter((d) => d.status === "APPROVED").length;
      ctx += `\n### 資料審核進度\n`;
      ctx += `- 草稿：${currentData.filter((d) => d.status === "DRAFT").length} 筆\n`;
      ctx += `- 已送審：${currentData.filter((d) => d.status === "SUBMITTED").length} 筆\n`;
      ctx += `- 已核准：${approvedCount} 筆\n`;
      ctx += `- 已退回：${currentData.filter((d) => d.status === "REJECTED").length} 筆\n`;
      ctx += `- 審核完成率：${totalStatusCount > 0 ? ((approvedCount / totalStatusCount) * 100).toFixed(1) : 0}%\n`;
      ctx += yoyChange;
    }

    if (targets.length > 0) {
      ctx += `\n### 減量目標\n`;
      targets.forEach((t) => {
        ctx += `- ${t.targetYear}年目標：相較${t.baseYear}年減少 ${t.reductionPct}%（基準量 ${t.baselineAmount} tCO2e）— ${t.description}\n`;
      });
    }

    return ctx;
  } catch (error) {
    console.error("Error gathering company data:", error);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Chat API handler
// ---------------------------------------------------------------------------
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "請提供對話訊息" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "尚未設定 API 金鑰，請在環境變數中設定 DEEPSEEK_API_KEY" },
        { status: 500 }
      );
    }

    // Get the latest user message for web search
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    const searchQuery = lastUserMessage?.content ?? "";

    // Determine if we need company data (keywords that suggest analysis)
    const needsCompanyData = /公司|排放|分析|數據|統計|報告|比較|趨勢|減量|目標|廠區|碳排|盤查|現況|狀況|建議|排名|改善|效能|概況|總覽|dashboard/i.test(searchQuery);

    // Perform web search + company data gathering in parallel
    const [searchResults, companyData, client] = await Promise.all([
      searchWeb(searchQuery),
      needsCompanyData ? getCompanyDataContext() : Promise.resolve(""),
      Promise.resolve(
        new OpenAI({
          baseURL: "https://api.deepseek.com",
          apiKey,
        })
      ),
    ]);

    const searchContext = buildSearchContext(searchResults);

    // Keep conversation context within token limits:
    // Trim older messages if total character count exceeds ~24k chars (~8k tokens)
    let contextMessages = messages;
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    if (totalChars > 24000) {
      // Always keep the first user message for context + last 10 exchanges
      const keep = messages.slice(-20);
      if (messages.length > 20) {
        const firstUserMsg = messages.find((m) => m.role === "user");
        if (firstUserMsg && !keep.includes(firstUserMsg)) {
          keep.unshift(firstUserMsg);
        }
      }
      contextMessages = keep;
    }

    const stream = await client.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 4096,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: SYSTEM_PROMPT + companyData + searchContext },
        ...contextMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    // DeepSeek pricing (USD per million tokens):
    // Input: $0.27/M (cache miss), $0.07/M (cache hit)
    // Output: $1.10/M
    // USD to NTD: ~32.5
    const INPUT_COST_PER_TOKEN = 0.27 / 1_000_000;   // USD
    const OUTPUT_COST_PER_TOKEN = 1.10 / 1_000_000;   // USD
    const USD_TO_NTD = 32.5;

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let promptTokens = 0;
          let completionTokens = 0;

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
            // Capture usage from the final chunk
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens ?? 0;
              completionTokens = chunk.usage.completion_tokens ?? 0;
            }
          }

          // Send token usage as a separate event
          const costUsd =
            promptTokens * INPUT_COST_PER_TOKEN +
            completionTokens * OUTPUT_COST_PER_TOKEN;
          const costNtd = costUsd * USD_TO_NTD;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                usage: {
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens,
                  costNtd: Math.round(costNtd * 10000) / 10000,
                },
              })}\n\n`
            )
          );

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "聊天服務發生錯誤";
    return Response.json({ error: message }, { status: 500 });
  }
}
