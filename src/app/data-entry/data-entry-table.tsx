"use client";

import { useActionState, useState, useCallback } from "react";
import { deleteActivityData, submitActivityData, type DataEntryState } from "@/actions/data-entry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataEntryForm } from "./data-entry-form";

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

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  DRAFT: { label: "草稿", variant: "secondary" },
  SUBMITTED: { label: "已送審", variant: "default" },
  APPROVED: { label: "已核准", variant: "outline" },
  REJECTED: { label: "退回", variant: "destructive" },
};

const DATA_QUALITY_LABELS: Record<string, string> = {
  PRIMARY: "初級",
  SECONDARY: "次級",
  ESTIMATED: "推估",
};

function DeleteButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteActivityData, null);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="xs"
        disabled={pending}
        className="text-destructive hover:text-destructive"
      >
        {pending ? "..." : "刪除"}
      </Button>
      {state?.error && (
        <span className="ml-1 text-xs text-destructive">{state.error}</span>
      )}
    </form>
  );
}

function SubmitButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(submitActivityData, null);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="xs" disabled={pending}>
        {pending ? "..." : "送審"}
      </Button>
      {state?.error && (
        <span className="ml-1 text-xs text-destructive">{state.error}</span>
      )}
    </form>
  );
}

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
  };

  const handleAdd = () => {
    setEditData(null);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {data.length} 筆資料
        </p>
        {!showForm && (
          <Button onClick={handleAdd}>
            新增資料
          </Button>
        )}
      </div>

      {showForm && (
        <DataEntryForm
          periodId={periodId}
          sources={sources}
          factors={factors}
          editData={editData}
          onCancel={handleCancel}
        />
      )}

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
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-4 font-medium">月份</th>
                <th className="p-4 font-medium">排放源</th>
                <th className="p-4 font-medium">活動數據</th>
                <th className="p-4 font-medium">排放係數</th>
                <th className="p-4 font-medium text-right">排放量 tCO2e</th>
                <th className="p-4 font-medium">品質</th>
                <th className="p-4 font-medium">狀態</th>
                <th className="p-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const statusConfig = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-4">{row.month} 月</td>
                    <td className="p-4 font-medium">{row.source.name}</td>
                    <td className="p-4">
                      {row.activityAmount.toLocaleString()} {row.activityUnit}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {row.factor?.name || "—"}
                    </td>
                    <td className="p-4 text-right font-mono">
                      {row.emissionAmount !== null
                        ? row.emissionAmount.toFixed(4)
                        : "—"}
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-muted-foreground">
                        {DATA_QUALITY_LABELS[row.dataQuality] || row.dataQuality}
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {row.status === "DRAFT" && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleEdit(row)}
                          >
                            編輯
                          </Button>
                          <SubmitButton id={row.id} />
                          <DeleteButton id={row.id} />
                        </div>
                      )}
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
