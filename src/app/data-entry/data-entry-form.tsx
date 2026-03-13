"use client";

import { useActionState, useState, useEffect } from "react";
import { createActivityData, updateActivityData, type DataEntryState } from "@/actions/data-entry";
import { Button } from "@/components/ui/button";

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

type EditData = {
  id: string;
  sourceId: string;
  factorId: string | null;
  month: number;
  activityAmount: number;
  activityUnit: string;
  dataQuality: string;
  evidence: string;
} | null;

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} 月`,
}));

const DATA_QUALITY_OPTIONS = [
  { value: "PRIMARY", label: "初級數據（實測值）" },
  { value: "SECONDARY", label: "次級數據（文獻值）" },
  { value: "ESTIMATED", label: "推估數據" },
];

const inputClass =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function DataEntryForm({
  periodId,
  sources,
  factors,
  editData,
  onCancel,
}: {
  periodId: string;
  sources: Source[];
  factors: Factor[];
  editData?: EditData;
  onCancel: () => void;
}) {
  const isEditing = !!editData;
  const action = isEditing ? updateActivityData : createActivityData;
  const [state, formAction, pending] = useActionState(action, null);

  const [selectedSourceId, setSelectedSourceId] = useState(editData?.sourceId || "");
  const [selectedFactorId, setSelectedFactorId] = useState(editData?.factorId || "");
  const [activityUnit, setActivityUnit] = useState(editData?.activityUnit || "");

  // Filter factors based on selected source's scope and category
  const selectedSource = sources.find((s) => s.id === selectedSourceId);
  const matchingFactors = selectedSource
    ? factors.filter(
        (f) => f.scope === selectedSource.scope && f.category === selectedSource.category
      )
    : [];

  // Auto-fill unit when factor changes
  useEffect(() => {
    if (selectedFactorId) {
      const factor = factors.find((f) => f.id === selectedFactorId);
      if (factor) {
        // Extract input unit from factor unit (e.g., "kgCO2e/kWh" -> "kWh")
        const parts = factor.unit.split("/");
        if (parts.length > 1) {
          setActivityUnit(parts[parts.length - 1]);
        }
      }
    }
  }, [selectedFactorId, factors]);

  // Reset factor when source changes
  useEffect(() => {
    if (!isEditing) {
      setSelectedFactorId("");
      setActivityUnit("");
    }
  }, [selectedSourceId, isEditing]);

  // Close form on success
  useEffect(() => {
    if (state?.success) {
      onCancel();
    }
  }, [state?.success, onCancel]);

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">
        {isEditing ? "編輯活動數據" : "新增活動數據"}
      </h3>
      <form action={formAction} className="space-y-4">
        {isEditing && <input type="hidden" name="id" value={editData.id} />}
        <input type="hidden" name="periodId" value={periodId} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Emission Source */}
          <div>
            <label htmlFor="sourceId" className="text-sm font-medium">
              排放源 <span className="text-destructive">*</span>
            </label>
            <select
              id="sourceId"
              name="sourceId"
              required
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className={inputClass + " mt-1"}
              disabled={isEditing}
            >
              <option value="">請選擇排放源</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}（範疇{source.scope}）
                </option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label htmlFor="month" className="text-sm font-medium">
              月份 <span className="text-destructive">*</span>
            </label>
            <select
              id="month"
              name="month"
              required
              defaultValue={editData?.month || ""}
              className={inputClass + " mt-1"}
            >
              <option value="">請選擇月份</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Emission Factor */}
          <div>
            <label htmlFor="factorId" className="text-sm font-medium">
              排放係數
            </label>
            <select
              id="factorId"
              name="factorId"
              value={selectedFactorId}
              onChange={(e) => setSelectedFactorId(e.target.value)}
              className={inputClass + " mt-1"}
              disabled={!selectedSourceId}
            >
              <option value="">請選擇排放係數</option>
              {matchingFactors.map((factor) => (
                <option key={factor.id} value={factor.id}>
                  {factor.name}（{factor.totalFactor} {factor.unit}）
                </option>
              ))}
            </select>
            {selectedSourceId && matchingFactors.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                此排放源類別尚無可用排放係數
              </p>
            )}
          </div>

          {/* Activity Amount */}
          <div>
            <label htmlFor="activityAmount" className="text-sm font-medium">
              活動數據量 <span className="text-destructive">*</span>
            </label>
            <input
              id="activityAmount"
              name="activityAmount"
              type="number"
              step="any"
              min="0"
              required
              defaultValue={editData?.activityAmount || ""}
              className={inputClass + " mt-1"}
              placeholder="例如：1000"
            />
          </div>

          {/* Activity Unit */}
          <div>
            <label htmlFor="activityUnit" className="text-sm font-medium">
              活動數據單位 <span className="text-destructive">*</span>
            </label>
            <input
              id="activityUnit"
              name="activityUnit"
              type="text"
              required
              value={activityUnit}
              onChange={(e) => setActivityUnit(e.target.value)}
              className={inputClass + " mt-1"}
              placeholder="例如：kWh、L、m3"
            />
          </div>

          {/* Data Quality */}
          <div>
            <label className="text-sm font-medium">
              數據品質 <span className="text-destructive">*</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-4">
              {DATA_QUALITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="dataQuality"
                    value={opt.value}
                    defaultChecked={
                      editData ? editData.dataQuality === opt.value : opt.value === "PRIMARY"
                    }
                    className="accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Evidence */}
        <div>
          <label htmlFor="evidence" className="text-sm font-medium">
            佐證說明
          </label>
          <textarea
            id="evidence"
            name="evidence"
            rows={2}
            defaultValue={editData?.evidence || ""}
            className={inputClass + " mt-1 resize-none"}
            placeholder="請簡述數據來源或佐證文件"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? isEditing
                ? "更新中..."
                : "新增中..."
              : isEditing
                ? "更新資料"
                : "新增資料"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        </div>
      </form>
    </div>
  );
}
