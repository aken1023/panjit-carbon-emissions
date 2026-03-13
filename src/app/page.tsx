import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCOPE_LABELS, formatEmission } from "@/lib/emission";
import {
  Flame,
  Zap,
  TrendingDown,
  ClipboardCheck,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Get current inventory period
  const currentPeriod = await prisma.inventoryPeriod.findFirst({
    where: { orgId: user.orgId, status: { not: "LOCKED" } },
    orderBy: { year: "desc" },
  });

  // Get emission summary by scope
  const activityData = currentPeriod
    ? await prisma.activityData.findMany({
        where: { periodId: currentPeriod.id, status: "APPROVED" },
        include: { source: true },
      })
    : [];

  const scope1Total = activityData
    .filter((d) => d.source.scope === 1)
    .reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
  const scope2Total = activityData
    .filter((d) => d.source.scope === 2)
    .reduce((sum, d) => sum + (d.emissionAmount ?? 0), 0);
  const grandTotal = scope1Total + scope2Total;

  // Task completion
  const tasks = currentPeriod
    ? await prisma.taskAssignment.findMany({
        where: { periodId: currentPeriod.id },
      })
    : [];
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const stats = [
    {
      label: SCOPE_LABELS[1],
      value: formatEmission(scope1Total),
      icon: Flame,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: SCOPE_LABELS[2],
      value: formatEmission(scope2Total),
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "排放總量",
      value: formatEmission(grandTotal),
      icon: TrendingDown,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "盤查進度",
      value: `${completionRate}%`,
      icon: ClipboardCheck,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {currentPeriod ? `${currentPeriod.name}` : "碳排管理儀表板"}
        </h1>
        <p className="text-muted-foreground">
          {user.organization.name} - 排放數據總覽
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Placeholder for charts */}
      {!currentPeriod && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚未建立盤查期間
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先至「碳盤查管理」建立年度盤查期間，開始進行溫室氣體盤查作業。
          </p>
        </div>
      )}
    </div>
  );
}
