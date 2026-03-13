"use client";

import { useActionState, useState, useCallback } from "react";
import {
  deleteActivityData,
  submitActivityData,
  approveActivityData,
  rejectActivityData,
  revertToDraft,
  type DataEntryState,
} from "@/actions/data-entry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataEntryForm } from "./data-entry-form";
import {
  Pencil,
  Trash2,
  SendHorizonal,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Plus,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityDataRow = {
  id: string;
  month: number;
  activityAmount: number;
  activityUnit: string;
  emissionAmount: number | null;
  dataQuality: string;
  evidence: string;
  status: string;
  source: { id: string; name: string; scope: number; category: string };
  factor: { id: string; name: string } | null;
};

type Source = {
  id: string;
  name: string;
  scope: number;
  category: string;
};

type Factor = {
  id: string;
  name: string;
  scope: number;
  category: string;
  unit: string;
  totalFactor: number;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string }
> = {
  DRAFT: { label: "草稿", variant: "secondary", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  SUBMITTED: { label: "已送審", variant: "default", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  APPROVED: { label: "已核准", variant: "outline", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  REJECTED: { label: "退回", variant: "destructive", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const DATA_QUALITY_LABELS: Record<string, string> = {
  PRIMARY: "初級",
  SECONDARY: "次級",
  ESTIMATED: "推估",
};

const QUALITY_COLORS: Record<string, string> = {
  PRIMARY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  SECONDARY: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  ESTIMATED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

// --- Action Buttons ---

function ActionButton({
  action,
  id,
  icon: Icon,
  label,
  variant = "ghost",
  className,
}: {
  action: (prev: DataEntryState, formData: FormData) => Promise<DataEntryState>;
  id: string;
  icon: React.ElementType;
  label: string;
  variant?: "ghost" | "outline" | "destructive";
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          variant === "ghost" && "hover:bg-accent",
          variant === "destructive" && "text-destructive hover:bg-destructive/10",
          variant === "outline" && "border hover:bg-accent",
          pending && "opacity-50",
          className
        )}
        title={label}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{pending ? "..." : label}</span>
      </button>
      {state?.error && (
        <span className="ml-1 text-[10px] text-destructive">{state.error}</span>
      )}
    </form>
  );
}

// --- Delete with confirmation ---

function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(deleteActivityData, null);

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1">
        <form action={formAction} className="inline">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-destructive px-2 py-0.5 text-[10px] font-medium text-destructive-foreground"
          >
            {pending ? "..." : "確認刪除"}
          </button>
        </form>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-0.5 text-[10px] font-medium hover:bg-accent"
        >
          取消
        </button>
        {state?.error && (
          <span className="text-[10px] text-destructive">{state.error}</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
      title="刪除"
    >
      <Trash2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">刪除</span>
    </button>
  );
}

// --- Main Table ---

export function DataEntryTable({
  periodId,
  data,
  sources,
  factors,
}: {
  periodId: string;
  data: ActivityDataRow[];
  sources: Source[];
  factors: Factor[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<{
    id: string;
    sourceId: string;
    factorId: string | null;
    month: number;
    activityAmount: number;
    activityUnit: string;
    dataQuality: string;
    evidence: string;
  } | null>(null);

  // Filters
  const [filterScope, setFilterScope] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<number | null>(null);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditData(null);
  }, []);

  const handleEdit = (row: ActivityDataRow) => {
    setEditData({
      id: row.id,
      sourceId: row.source.id,
      factorId: row.factor?.id || null,
      month: row.month,
      activityAmount: row.activityAmount,
      activityUnit: row.activityUnit,
      dataQuality: row.dataQuality,
      evidence: row.evidence,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAdd = () => {
    setEditData(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Apply filters
  const filteredData = data.filter((row) => {
    if (filterScope !== null && row.source.scope !== filterScope) return false;
    if (filterStatus !== null && row.status !== filterStatus) return false;
    if (filterMonth !== null && row.month !== filterMonth) return false;
    return true;
  });

  // Summary stats
  const stats = {
    total: data.length,
    draft: data.filter((d) => d.status === "DRAFT").length,
    submitted: data.filter((d) => d.status === "SUBMITTED").length,
    approved: data.filter((d) => d.status === "APPROVED").length,
    rejected: data.filter((d) => d.status === "REJECTED").length,
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        <button
          onClick={() => setFilterStatus(null)}
          className={cn(
            "rounded-xl border p-3 text-left transition-colors",
            filterStatus === null ? "border-primary bg-primary/5" : "bg-card hover:bg-accent"
          )}
        >
          <p className="text-[10px] text-muted-foreground sm:text-xs">全部</p>
          <p className="text-lg font-bold sm:text-xl">{stats.total}</p>
        </button>
        {(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = stats[s.toLowerCase() as keyof typeof stats];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? null : s)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                filterStatus === s ? "border-primary bg-primary/5" : "bg-card hover:bg-accent"
              )}
            >
              <p className="text-[10px] text-muted-foreground sm:text-xs">{cfg.label}</p>
              <p className="text-lg font-bold sm:text-xl">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            篩選:
          </div>
          {/* Scope filter */}
          <select
            value={filterScope ?? ""}
            onChange={(e) => setFilterScope(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border bg-background px-2 py-1 text-xs"
          >
            <option value="">所有範疇</option>
            <option value="1">範疇一</option>
            <option value="2">範疇二</option>
          </select>
          {/* Month filter */}
          <select
            value={filterMonth ?? ""}
            onChange={(e) => setFilterMonth(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border bg-background px-2 py-1 text-xs"
          >
            <option value="">所有月份</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1} 月</option>
            ))}
          </select>
          <span className="text-[10px] text-muted-foreground">
            顯示 {filteredData.length} / {data.length} 筆
          </span>
        </div>
        {!showForm && (
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增資料
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <DataEntryForm
          periodId={periodId}
          sources={sources}
          factors={factors}
          editData={editData}
          onCancel={handleCancel}
        />
      )}

      {/* Table */}
      {data.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚無活動數據
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請點擊「新增資料」開始填報
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground bg-muted/30">
                <th className="p-3 sm:p-4 font-medium w-16">月份</th>
                <th className="p-3 sm:p-4 font-medium">排放源</th>
                <th className="p-3 sm:p-4 font-medium hidden lg:table-cell">範疇</th>
                <th className="p-3 sm:p-4 font-medium">活動數據</th>
                <th className="p-3 sm:p-4 font-medium hidden md:table-cell">排放係數</th>
                <th className="p-3 sm:p-4 font-medium text-right">排放量</th>
                <th className="p-3 sm:p-4 font-medium w-16">品質</th>
                <th className="p-3 sm:p-4 font-medium w-20">狀態</th>
                <th className="p-3 sm:p-4 font-medium w-48">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => {
                const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
                const qualityCfg = QUALITY_COLORS[row.dataQuality] || "";
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/20",
                      row.status === "REJECTED" && "bg-red-50/30 dark:bg-red-950/10"
                    )}
                  >
                    <td className="p-3 sm:p-4 font-mono">{row.month} 月</td>
                    <td className="p-3 sm:p-4">
                      <span className="font-medium">{row.source.name}</span>
                    </td>
                    <td className="p-3 sm:p-4 hidden lg:table-cell">
                      <Badge variant="outline" className="text-[10px]">
                        範疇{row.source.scope}
                      </Badge>
                    </td>
                    <td className="p-3 sm:p-4">
                      <span className="font-mono">{row.activityAmount.toLocaleString()}</span>
                      <span className="ml-1 text-xs text-muted-foreground">{row.activityUnit}</span>
                    </td>
                    <td className="p-3 sm:p-4 text-muted-foreground text-xs hidden md:table-cell">
                      {row.factor?.name || "—"}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-mono">
                      {row.emissionAmount !== null
                        ? row.emissionAmount.toFixed(4)
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 sm:p-4">
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", qualityCfg)}>
                        {DATA_QUALITY_LABELS[row.dataQuality] || row.dataQuality}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4">
                      <div className="flex flex-wrap items-center gap-0.5">
                        {/* DRAFT: edit, submit, delete */}
                        {row.status === "DRAFT" && (
                          <>
                            <button
                              onClick={() => handleEdit(row)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
                              title="編輯"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">編輯</span>
                            </button>
                            <ActionButton action={submitActivityData} id={row.id} icon={SendHorizonal} label="送審" />
                            <DeleteButton id={row.id} />
                          </>
                        )}
                        {/* SUBMITTED: approve, reject, revert */}
                        {row.status === "SUBMITTED" && (
                          <>
                            <ActionButton action={approveActivityData} id={row.id} icon={CheckCircle2} label="核准" className="text-emerald-600" />
                            <ActionButton action={rejectActivityData} id={row.id} icon={XCircle} label="退回" className="text-red-600" />
                            <ActionButton action={revertToDraft} id={row.id} icon={RotateCcw} label="撤回" />
                          </>
                        )}
                        {/* APPROVED: revert (admin only) */}
                        {row.status === "APPROVED" && (
                          <ActionButton action={revertToDraft} id={row.id} icon={RotateCcw} label="撤回核准" />
                        )}
                        {/* REJECTED: edit, revert to draft, delete */}
                        {row.status === "REJECTED" && (
                          <>
                            <button
                              onClick={() => handleEdit(row)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-accent"
                              title="編輯"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">編輯</span>
                            </button>
                            <ActionButton action={revertToDraft} id={row.id} icon={RotateCcw} label="退回草稿" />
                            <DeleteButton id={row.id} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
