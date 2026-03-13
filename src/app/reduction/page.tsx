import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatEmission } from "@/lib/emission";
import { CreateTargetForm } from "./create-target-form";
import { DeleteTargetButton } from "./delete-target-button";
import { CarbonFeeCalc } from "./carbon-fee-calc";
import { Badge } from "@/components/ui/badge";

export default async function ReductionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const targets = await prisma.reductionTarget.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
  });

  // Get all approved activity data grouped by year for progress tracking
  const periods = await prisma.inventoryPeriod.findMany({
    where: { orgId: user.orgId },
    include: {
      activityData: {
        where: { status: "APPROVED" },
        select: { emissionAmount: true },
      },
    },
  });

  const emissionsByYear: Record<number, number> = {};
  for (const period of periods) {
    const total = period.activityData.reduce(
      (sum, d) => sum + (d.emissionAmount ?? 0),
      0
    );
    if (total > 0) {
      emissionsByYear[period.year] = total;
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    ABSOLUTE: "絕對減量",
    INTENSITY: "強度減量",
  };

  function getSbtiAlignment(baseYear: number, targetYear: number, reductionPct: number) {
    const years = targetYear - baseYear;
    if (years <= 0) return null;
    const annualRate = reductionPct / years;
    return {
      annualRate,
      meets15: annualRate >= 4.2,
      meetsWB2: annualRate >= 2.5,
    };
  }

  function getProgress(target: (typeof targets)[0]) {
    // Find the latest year with emission data between base and target years
    let latestYear: number | null = null;
    let latestEmission: number | null = null;

    for (const [yearStr, emission] of Object.entries(emissionsByYear)) {
      const year = parseInt(yearStr);
      if (year > target.baseYear && year <= target.targetYear) {
        if (!latestYear || year > latestYear) {
          latestYear = year;
          latestEmission = emission;
        }
      }
    }

    if (!latestYear || latestEmission === null) return null;

    const targetAmount = target.baselineAmount * (1 - target.reductionPct / 100);
    const totalReductionNeeded = target.baselineAmount - targetAmount;
    const actualReduction = target.baselineAmount - latestEmission;
    const progressPct =
      totalReductionNeeded > 0
        ? Math.min(100, Math.max(0, (actualReduction / totalReductionNeeded) * 100))
        : 0;

    return {
      year: latestYear,
      emission: latestEmission,
      progressPct,
    };
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">減碳管理</h1>
          <p className="text-muted-foreground">
            設定減碳目標、追蹤減碳進度與碳費試算
          </p>
        </div>
        <CreateTargetForm />
      </div>

      {/* Reduction Targets */}
      {targets.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚未建立減碳目標
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            點擊「新增目標」建立您的第一個減碳目標
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((target) => {
            const targetAmount =
              target.baselineAmount * (1 - target.reductionPct / 100);
            const sbti = getSbtiAlignment(
              target.baseYear,
              target.targetYear,
              target.reductionPct
            );
            const progress = getProgress(target);

            return (
              <div
                key={target.id}
                className="rounded-xl border bg-card p-5 space-y-4"
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {target.baseYear} &rarr; {target.targetYear}
                      </span>
                    </div>
                    <Badge variant="secondary" className="mt-1">
                      {TYPE_LABELS[target.targetType] ?? target.targetType}
                    </Badge>
                  </div>
                  <DeleteTargetButton id={target.id} />
                </div>

                {/* Reduction percentage */}
                <div className="text-center rounded-lg bg-muted/50 py-3">
                  <p className="text-3xl font-bold tabular-nums">
                    {target.reductionPct}%
                  </p>
                  <p className="text-xs text-muted-foreground">減碳百分比</p>
                </div>

                {/* Emission details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">基準年排放量</p>
                    <p className="font-medium">
                      {formatEmission(target.baselineAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">目標排放量</p>
                    <p className="font-medium">
                      {formatEmission(targetAmount)}
                    </p>
                  </div>
                </div>

                {/* Description */}
                {target.description && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">說明</p>
                    <p>{target.description}</p>
                  </div>
                )}

                {/* SBTi alignment */}
                {sbti && (
                  <div className="space-y-1 text-xs">
                    <p className="font-medium text-muted-foreground">
                      SBTi 對齊（年均 {sbti.annualRate.toFixed(1)}%）
                    </p>
                    <div className="flex gap-2">
                      <Badge
                        variant={sbti.meets15 ? "default" : "outline"}
                        className={sbti.meets15 ? "bg-green-600" : ""}
                      >
                        1.5°C {sbti.meets15 ? "符合" : "未達"}
                      </Badge>
                      <Badge
                        variant={sbti.meetsWB2 ? "default" : "outline"}
                        className={sbti.meetsWB2 ? "bg-blue-600" : ""}
                      >
                        WB2°C {sbti.meetsWB2 ? "符合" : "未達"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Progress */}
                {progress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {progress.year} 年進度
                      </span>
                      <span className="font-medium">
                        {progress.progressPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progress.progressPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      實際排放：{formatEmission(progress.emission)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Carbon Fee Calculator */}
      <CarbonFeeCalc />

      {/* SBTi Reference */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">SBTi 目標對齊參考</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          科學基礎減碳目標倡議（Science Based Targets initiative）建議路徑
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700 text-sm font-bold">
                1.5
              </span>
              <div>
                <p className="font-medium">1.5°C 路徑</p>
                <p className="text-sm text-muted-foreground">
                  年均減碳 4.2%
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              符合巴黎協定最積極目標，適用於近期目標（5-10年）
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                2.0
              </span>
              <div>
                <p className="font-medium">Well-below 2°C 路徑</p>
                <p className="text-sm text-muted-foreground">
                  年均減碳 2.5%
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              低於 2°C 的升溫控制路徑，最低門檻要求
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
