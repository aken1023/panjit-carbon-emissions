import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateInventoryForm, DeleteInventoryButton } from "./inventory-form";
import {
  WorkflowIndicator,
  WorkflowControls,
  DataCompletionStats,
  ApprovalBreakdown,
  TaskList,
} from "./workflow-controls";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const periods = await prisma.inventoryPeriod.findMany({
    where: { orgId: user.orgId },
    orderBy: { year: "desc" },
    include: {
      _count: { select: { activityData: true } },
      activityData: {
        select: { month: true, status: true, sourceId: true },
      },
      tasks: {
        select: {
          id: true,
          description: true,
          status: true,
          dueDate: true,
          assignee: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  // Get total emission sources count for this org
  const totalSources = await prisma.emissionSource.count({
    where: {
      unit: { orgId: user.orgId },
      isActive: true,
    },
  });

  const STATUS_LABELS: Record<string, string> = {
    OPEN: "資料填報中",
    IN_REVIEW: "審查中",
    VERIFIED: "已驗證",
    LOCKED: "已鎖定",
  };

  const STATUS_COLORS: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    IN_REVIEW: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    VERIFIED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    LOCKED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">碳盤查管理</h1>
          <p className="text-muted-foreground">管理年度盤查期間與排放源清單</p>
        </div>
        <CreateInventoryForm />
      </div>

      {periods.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚未建立盤查期間
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            點擊上方按鈕建立第一個年度盤查期間
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {periods.map((period) => {
            const canDelete =
              period.status === "OPEN" && period._count.activityData === 0;

            // Compute monthly data counts (unique sources per month)
            const monthlyMap = new Map<number, Set<string>>();
            for (const d of period.activityData) {
              if (!monthlyMap.has(d.month)) {
                monthlyMap.set(d.month, new Set());
              }
              monthlyMap.get(d.month)!.add(d.sourceId);
            }
            const monthlyData = Array.from(monthlyMap.entries()).map(
              ([month, sources]) => ({ month, count: sources.size })
            );

            // Compute approval status breakdown
            const statusCountMap = new Map<string, number>();
            for (const d of period.activityData) {
              statusCountMap.set(d.status, (statusCountMap.get(d.status) ?? 0) + 1);
            }
            const approvalCounts = Array.from(statusCountMap.entries()).map(
              ([status, count]) => ({ status, count })
            );

            // Format tasks for client component
            const formattedTasks = period.tasks.map((t) => ({
              id: t.id,
              description: t.description,
              status: t.status,
              dueDate: t.dueDate
                ? t.dueDate.toLocaleDateString("zh-TW")
                : null,
              assigneeName: t.assignee.name,
            }));

            return (
              <div
                key={period.id}
                className="rounded-xl border bg-card"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{period.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[period.status]}`}
                    >
                      {STATUS_LABELS[period.status]}
                    </span>
                    {period.isBaseYear && (
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        基準年
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {period.year} 年度 | {period._count.activityData} 筆資料
                    </span>
                    <DeleteInventoryButton id={period.id} disabled={!canDelete} />
                  </div>
                </div>

                {/* Workflow indicator */}
                <div className="px-5 py-4">
                  <WorkflowIndicator currentStatus={period.status} />
                </div>

                {/* Detail stats */}
                <div className="space-y-4 border-t px-5 py-4">
                  <DataCompletionStats
                    monthlyData={monthlyData}
                    totalSources={totalSources}
                  />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <ApprovalBreakdown counts={approvalCounts} />
                    <TaskList tasks={formattedTasks} />
                  </div>
                </div>

                {/* Workflow controls */}
                {period.status !== "LOCKED" && (
                  <div className="border-t px-5 py-4">
                    <WorkflowControls
                      periodId={period.id}
                      currentStatus={period.status}
                      userRole={user.role}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
