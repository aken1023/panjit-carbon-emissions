"use client";

import { useActionState } from "react";
import { updatePeriodStatus, type InventoryActionState } from "@/actions/inventory";
import { Button } from "@/components/ui/button";

const WORKFLOW_STEPS = [
  { key: "OPEN", label: "資料填報中" },
  { key: "IN_REVIEW", label: "審查中" },
  { key: "VERIFIED", label: "已驗證" },
  { key: "LOCKED", label: "已鎖定" },
] as const;

// Forward transitions
const FORWARD_TRANSITIONS: Record<string, { target: string; label: string }> = {
  OPEN: { target: "IN_REVIEW", label: "送出審查" },
  IN_REVIEW: { target: "VERIFIED", label: "確認驗證" },
  VERIFIED: { target: "LOCKED", label: "鎖定期間" },
};

// Rollback transitions
const ROLLBACK_TRANSITIONS: Record<string, { target: string; label: string }> = {
  IN_REVIEW: { target: "OPEN", label: "退回填報" },
  VERIFIED: { target: "IN_REVIEW", label: "退回審查" },
};

interface WorkflowIndicatorProps {
  currentStatus: string;
}

export function WorkflowIndicator({ currentStatus }: WorkflowIndicatorProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <nav aria-label="盤查流程進度" className="w-full">
      <ol className="flex items-center gap-0">
        {WORKFLOW_STEPS.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <li
              key={step.key}
              className="flex flex-1 items-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              {index > 0 && (
                <div
                  className={`h-0.5 flex-1 transition-colors ${
                    isComplete ? "bg-primary" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    isComplete
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {isComplete ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="size-4"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-xs whitespace-nowrap ${
                    isCurrent
                      ? "font-semibold text-primary"
                      : isFuture
                        ? "text-muted-foreground"
                        : "font-medium text-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 transition-colors ${
                    isComplete ? "bg-primary" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface WorkflowControlsProps {
  periodId: string;
  currentStatus: string;
  userRole: string;
}

export function WorkflowControls({
  periodId,
  currentStatus,
  userRole,
}: WorkflowControlsProps) {
  const [state, formAction, pending] = useActionState(updatePeriodStatus, null);
  const canManage = ["ADMIN", "CARBON_MANAGER"].includes(userRole);

  const forward = FORWARD_TRANSITIONS[currentStatus];
  const rollback = ROLLBACK_TRANSITIONS[currentStatus];

  if (!canManage || (!forward && !rollback)) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {forward && (
          <form action={formAction}>
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="newStatus" value={forward.target} />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "處理中..." : forward.label}
            </Button>
          </form>
        )}
        {rollback && (
          <form action={formAction}>
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="newStatus" value={rollback.target} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "處理中..." : rollback.label}
            </Button>
          </form>
        )}
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </div>
  );
}

interface DataCompletionStatsProps {
  monthlyData: { month: number; count: number }[];
  totalSources: number;
}

export function DataCompletionStats({
  monthlyData,
  totalSources,
}: DataCompletionStatsProps) {
  const months = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];

  const monthMap = new Map(monthlyData.map((d) => [d.month, d.count]));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">各月資料填寫進度</h4>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {months.map((label, index) => {
          const count = monthMap.get(index + 1) ?? 0;
          const pct = totalSources > 0 ? Math.round((count / totalSources) * 100) : 0;
          const bgColor =
            pct === 0
              ? "bg-muted"
              : pct < 50
                ? "bg-amber-100 dark:bg-amber-900/30"
                : pct < 100
                  ? "bg-blue-100 dark:bg-blue-900/30"
                  : "bg-green-100 dark:bg-green-900/30";

          return (
            <div
              key={index}
              className={`rounded-lg p-2 text-center ${bgColor}`}
            >
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-sm font-semibold">{count}</div>
              <div className="text-[10px] text-muted-foreground">{pct}%</div>
            </div>
          );
        })}
      </div>
      {totalSources > 0 && (
        <p className="text-xs text-muted-foreground">
          共 {totalSources} 個排放源
        </p>
      )}
    </div>
  );
}

interface ApprovalBreakdownProps {
  counts: { status: string; count: number }[];
}

export function ApprovalBreakdown({ counts }: ApprovalBreakdownProps) {
  const labels: Record<string, { label: string; color: string }> = {
    DRAFT: { label: "草稿", color: "bg-gray-200 dark:bg-gray-700" },
    SUBMITTED: { label: "已送審", color: "bg-blue-200 dark:bg-blue-800" },
    APPROVED: { label: "已核准", color: "bg-green-200 dark:bg-green-800" },
    REJECTED: { label: "已退回", color: "bg-red-200 dark:bg-red-800" },
  };

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const countMap = new Map(counts.map((c) => [c.status, c.count]));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">審核狀態分布</h4>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">尚無活動數據</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="審核狀態比例">
            {Object.entries(labels).map(([key, { color }]) => {
              const count = countMap.get(key) ?? 0;
              if (count === 0) return null;
              const widthPct = (count / total) * 100;
              return (
                <div
                  key={key}
                  className={`${color} transition-all`}
                  style={{ width: `${widthPct}%` }}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(labels).map(([key, { label, color }]) => {
              const count = countMap.get(key) ?? 0;
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <div className={`size-2.5 rounded-full ${color}`} />
                  <span className="text-muted-foreground">
                    {label}: <span className="font-medium text-foreground">{count}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface TaskListProps {
  tasks: {
    id: string;
    description: string;
    status: string;
    dueDate: string | null;
    assigneeName: string;
  }[];
}

const TASK_STATUS_LABELS: Record<string, { label: string; dotColor: string }> = {
  PENDING: { label: "待處理", dotColor: "bg-gray-400" },
  IN_PROGRESS: { label: "進行中", dotColor: "bg-blue-500" },
  COMPLETED: { label: "已完成", dotColor: "bg-green-500" },
  OVERDUE: { label: "已逾期", dotColor: "bg-red-500" },
};

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">任務指派</h4>
        <p className="text-sm text-muted-foreground">尚無指派任務</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">任務指派 ({tasks.length})</h4>
      <ul className="divide-y rounded-lg border">
        {tasks.map((task) => {
          const statusInfo = TASK_STATUS_LABELS[task.status] ?? TASK_STATUS_LABELS.PENDING;
          return (
            <li key={task.id} className="flex items-center gap-3 px-3 py-2">
              <div className={`size-2 shrink-0 rounded-full ${statusInfo.dotColor}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{task.description}</p>
                <p className="text-xs text-muted-foreground">
                  {task.assigneeName}
                  {task.dueDate && ` | 截止: ${task.dueDate}`}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {statusInfo.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
