"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { batchImportActivityData, type ImportRow } from "@/actions/data-import";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Period {
  id: string;
  name: string;
  year: number;
}

interface Source {
  id: string;
  name: string;
  unitName: string;
  scope: number;
  category: string;
}

interface Factor {
  id: string;
  name: string;
  scope: number;
  category: string;
  unit: string;
  totalFactor: number;
}

interface ImportPageProps {
  userId: string;
  periods: Period[];
  sources: Source[];
  factors: Factor[];
}

// The fields a user can map CSV columns to
const FIELD_OPTIONS = [
  { value: "", label: "-- 略過 --" },
  { value: "sourceName", label: "排放源名稱" },
  { value: "month", label: "月份 (1-12)" },
  { value: "activityAmount", label: "活動數據量" },
  { value: "activityUnit", label: "活動數據單位" },
  { value: "dataQuality", label: "數據品質" },
] as const;

type FieldKey = (typeof FIELD_OPTIONS)[number]["value"];

// Header name auto-detection mapping
const HEADER_ALIASES: Record<string, FieldKey> = {
  "排放源名稱": "sourceName",
  排放源: "sourceName",
  source: "sourceName",
  月份: "month",
  month: "month",
  活動數據量: "activityAmount",
  數據量: "activityAmount",
  amount: "activityAmount",
  活動數據單位: "activityUnit",
  單位: "activityUnit",
  unit: "activityUnit",
  數據品質: "dataQuality",
  品質: "dataQuality",
  quality: "dataQuality",
};

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

function parseCSV(text: string): string[][] {
  // Strip UTF-8 BOM
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationRow {
  index: number;
  data: ImportRow;
  errors: string[];
  valid: boolean;
}

function validateRows(
  rows: Record<string, string>[],
  mapping: Record<number, FieldKey>,
  sourceNames: Set<string>
): ValidationRow[] {
  return rows.map((row, idx) => {
    const errors: string[] = [];

    // Build mapped values
    const mapped: Record<string, string> = {};
    for (const [colIdx, field] of Object.entries(mapping)) {
      if (field) {
        const values = Object.values(row);
        mapped[field] = values[Number(colIdx)] ?? "";
      }
    }

    const sourceName = mapped.sourceName?.trim() ?? "";
    const monthStr = mapped.month?.trim() ?? "";
    const amountStr = mapped.activityAmount?.trim() ?? "";
    const unit = mapped.activityUnit?.trim() ?? "";
    const quality = mapped.dataQuality?.trim().toUpperCase() ?? "";

    if (!sourceName) errors.push("排放源名稱為空");
    else if (!sourceNames.has(sourceName))
      errors.push(`排放源「${sourceName}」不存在系統中`);

    const month = parseInt(monthStr, 10);
    if (!monthStr || isNaN(month)) errors.push("月份為空或不是數字");
    else if (month < 1 || month > 12) errors.push(`月份 ${month} 無效`);

    const amount = parseFloat(amountStr);
    if (!amountStr || isNaN(amount)) errors.push("活動數據量為空或不是數字");
    else if (amount <= 0) errors.push("活動數據量必須大於 0");

    if (!unit) errors.push("活動數據單位為空");

    if (
      quality &&
      !["PRIMARY", "SECONDARY", "ESTIMATED"].includes(quality)
    ) {
      errors.push(`數據品質「${quality}」無效`);
    }

    return {
      index: idx,
      data: {
        sourceName,
        month: isNaN(month) ? 0 : month,
        activityAmount: isNaN(amount) ? 0 : amount,
        activityUnit: unit,
        dataQuality: quality || "SECONDARY",
      },
      errors,
      valid: errors.length === 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Step indicator component
// ---------------------------------------------------------------------------

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const labels = ["上傳檔案", "欄位對應", "驗證預覽", "匯入結果"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 ${
                  isDone ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? "\u2713" : step}
              </span>
              <span
                className={`text-sm ${
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImportPage({
  userId,
  periods,
  sources,
  factors,
}: ImportPageProps) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, FieldKey>>(
    {}
  );
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    periods[0]?.id ?? ""
  );
  const [validationResults, setValidationResults] = useState<ValidationRow[]>(
    []
  );
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: string[];
    total: number;
    error?: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sourceNames = useMemo(
    () => new Set(sources.map((s) => s.name)),
    [sources]
  );

  const headers = rawRows[0] ?? [];
  const dataRows = rawRows.slice(1);

  // ----- Step 1: File handling -----

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "xlsx" || ext === "xls") {
        alert(
          "目前不支援直接讀取 .xlsx 檔案。\n請先在 Excel 中「另存新檔」選擇 CSV (UTF-8) 格式後再上傳。"
        );
        return;
      }

      if (ext !== "csv") {
        alert("請上傳 .csv 檔案");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          alert("檔案中至少需要包含標題列和一列數據");
          return;
        }
        setRawRows(rows);
        setFileName(file.name);

        // Auto-detect column mapping from headers
        const mapping: Record<number, FieldKey> = {};
        rows[0].forEach((header, idx) => {
          const normalized = header.trim().toLowerCase();
          for (const [alias, field] of Object.entries(HEADER_ALIASES)) {
            if (normalized === alias.toLowerCase()) {
              mapping[idx] = field;
              break;
            }
          }
        });
        setColumnMapping(mapping);
        setStep(2);
      };
      reader.readAsText(file, "UTF-8");
    },
    []
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ----- Step 2: Mapping -----

  const updateMapping = (colIdx: number, field: FieldKey) => {
    setColumnMapping((prev) => ({ ...prev, [colIdx]: field }));
  };

  const requiredFields: FieldKey[] = [
    "sourceName",
    "month",
    "activityAmount",
    "activityUnit",
  ];

  const mappedFields = Object.values(columnMapping).filter(Boolean);
  const missingRequired = requiredFields.filter(
    (f) => !mappedFields.includes(f)
  );

  // ----- Step 3: Validation -----

  const runValidation = () => {
    // Convert data rows to records indexed by column position
    const records = dataRows.map((row) => {
      const record: Record<string, string> = {};
      row.forEach((cell, idx) => {
        record[String(idx)] = cell;
      });
      return record;
    });

    // Re-key mapping for validation: colIdx -> fieldKey, but records store by colIdx as keys
    const results = validateRows(records, columnMapping, sourceNames);
    setValidationResults(results);
    setStep(3);
  };

  // ----- Step 4: Import -----

  const runImport = async () => {
    const validRows = validationResults.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    try {
      const result = await batchImportActivityData(
        selectedPeriodId,
        validRows.map((r) => r.data)
      );
      setImportResult(result);
      setStep(4);
    } catch {
      setImportResult({
        imported: 0,
        errors: ["匯入時發生未預期的錯誤"],
        total: validRows.length,
      });
      setStep(4);
    } finally {
      setImporting(false);
    }
  };

  // ----- Template download -----

  const downloadTemplate = () => {
    const bom = "\uFEFF";
    const header = "排放源名稱,月份,活動數據量,活動數據單位,數據品質";
    const exampleRows = sources.map(
      (s) => `${s.name},1,0,,SECONDARY`
    );
    const csv = bom + [header, ...exampleRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "碳排活動數據匯入範本.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- Reset -----

  const reset = () => {
    setStep(1);
    setFileName("");
    setRawRows([]);
    setColumnMapping({});
    setValidationResults([]);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // =========================================================================
  // Render
  // =========================================================================

  const validCount = validationResults.filter((r) => r.valid).length;
  const errorCount = validationResults.filter((r) => !r.valid).length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">批次匯入</h1>
          <p className="text-muted-foreground">
            上傳 CSV 檔案批次匯入活動數據
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          下載匯入範本
        </button>
      </div>

      {/* Step indicator */}
      <div className="rounded-xl border bg-card p-4">
        <StepIndicator current={step} total={4} />
      </div>

      {/* ============ Step 1: Upload ============ */}
      {step === 1 && (
        <div className="rounded-xl border bg-card p-8">
          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
          >
            <div className="mb-4 text-4xl text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="mb-2 text-lg font-medium">
              拖曳檔案至此處，或點擊選擇檔案
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              支援 CSV (UTF-8) 格式 / .xlsx 請先另存為 CSV
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              選擇檔案
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={onFileSelect}
            />
          </div>

          {/* Guide */}
          <div className="mt-6 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">匯入說明</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                CSV 檔案須包含標題列，欄位包含：排放源名稱、月份、活動數據量、活動數據單位、數據品質
              </li>
              <li>排放源名稱必須與系統中已建立的排放源完全一致</li>
              <li>月份為 1-12 的數字</li>
              <li>
                數據品質可為 PRIMARY（實測值）、SECONDARY（係數推估）、ESTIMATED（估算值）
              </li>
              <li>可先下載匯入範本，範本中已包含系統中所有排放源名稱</li>
            </ul>
          </div>
        </div>
      )}

      {/* ============ Step 2: Column Mapping ============ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">欄位對應</h2>
                <p className="text-sm text-muted-foreground">
                  已載入{" "}
                  <span className="font-medium text-foreground">
                    {fileName}
                  </span>
                  ，共 {dataRows.length} 列數據
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                重新上傳
              </button>
            </div>

            {/* Mapping dropdowns */}
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((header, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg border p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {header || `(欄位 ${idx + 1})`}
                  </span>
                  <select
                    value={columnMapping[idx] ?? ""}
                    onChange={(e) =>
                      updateMapping(idx, e.target.value as FieldKey)
                    }
                    className="rounded-md border bg-background px-2 py-1.5 text-sm"
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Missing fields warning */}
            {missingRequired.length > 0 && (
              <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                尚未對應必填欄位：
                {missingRequired
                  .map(
                    (f) =>
                      FIELD_OPTIONS.find((o) => o.value === f)?.label ?? f
                  )
                  .join("、")}
              </div>
            )}

            {/* Preview table */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                前 5 列預覽
              </h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        #
                      </th>
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-medium"
                        >
                          <div>{h || `(欄位 ${i + 1})`}</div>
                          {columnMapping[i] && (
                            <div className="mt-0.5 text-xs font-normal text-primary">
                              {
                                FIELD_OPTIONS.find(
                                  (o) => o.value === columnMapping[i]
                                )?.label
                              }
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} className="border-b last:border-b-0">
                        <td className="px-3 py-2 text-muted-foreground">
                          {ri + 1}
                        </td>
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-3 py-2">
                            {row[ci] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Period selection */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">選擇盤查期間</h2>
            {periods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                目前沒有開放的盤查期間，請先建立盤查期間
              </p>
            ) : (
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.year})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              上一步
            </button>
            <button
              type="button"
              onClick={runValidation}
              disabled={missingRequired.length > 0 || !selectedPeriodId}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              驗證數據
            </button>
          </div>
        </div>
      )}

      {/* ============ Step 3: Validation & Preview ============ */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5 text-center">
              <p className="text-3xl font-bold">{validationResults.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">總列數</p>
            </div>
            <div className="rounded-xl border bg-card p-5 text-center">
              <p className="text-3xl font-bold text-green-600">
                {validCount}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">可匯入</p>
            </div>
            <div className="rounded-xl border bg-card p-5 text-center">
              <p className="text-3xl font-bold text-red-600">{errorCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">錯誤</p>
            </div>
          </div>

          {/* Validation detail */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">驗證結果</h2>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      列
                    </th>
                    <th className="px-3 py-2 text-left font-medium">狀態</th>
                    <th className="px-3 py-2 text-left font-medium">
                      排放源名稱
                    </th>
                    <th className="px-3 py-2 text-left font-medium">月份</th>
                    <th className="px-3 py-2 text-left font-medium">
                      活動數據量
                    </th>
                    <th className="px-3 py-2 text-left font-medium">單位</th>
                    <th className="px-3 py-2 text-left font-medium">品質</th>
                    <th className="px-3 py-2 text-left font-medium">錯誤</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResults.map((row) => (
                    <tr
                      key={row.index}
                      className={`border-b last:border-b-0 ${
                        row.valid ? "" : "bg-red-50 dark:bg-red-950/20"
                      }`}
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {row.index + 1}
                      </td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                            有效
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                            錯誤
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.data.sourceName}</td>
                      <td className="px-3 py-2">{row.data.month || "-"}</td>
                      <td className="px-3 py-2">
                        {row.data.activityAmount || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.data.activityUnit || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.data.dataQuality || "-"}
                      </td>
                      <td className="px-3 py-2 text-red-600">
                        {row.errors.join("；")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              上一步
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={validCount === 0 || importing}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? "匯入中..." : `匯入 ${validCount} 筆有效數據`}
            </button>
          </div>
        </div>
      )}

      {/* ============ Step 4: Results ============ */}
      {step === 4 && importResult && (
        <div className="space-y-6">
          {/* Top-level error */}
          {importResult.error && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-700 dark:bg-red-950">
              <p className="text-lg font-semibold text-red-700 dark:text-red-300">
                匯入失敗
              </p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {importResult.error}
              </p>
            </div>
          )}

          {/* Success summary */}
          {!importResult.error && (
            <div className="rounded-xl border bg-card p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-green-600 dark:text-green-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-2xl font-bold">匯入完成</p>
              <p className="mt-2 text-muted-foreground">
                成功匯入{" "}
                <span className="font-semibold text-green-600">
                  {importResult.imported}
                </span>{" "}
                筆 / 共 {importResult.total} 筆
              </p>
            </div>
          )}

          {/* Server-side errors */}
          {importResult.errors.length > 0 && (
            <div className="rounded-xl border bg-card p-6">
              <h2 className="mb-3 text-lg font-semibold text-red-600">
                匯入錯誤 ({importResult.errors.length})
              </h2>
              <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
                {importResult.errors.map((err, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950 dark:text-red-300"
                  >
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              再次匯入
            </button>
            <a
              href="/data-entry"
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              前往資料填報
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
