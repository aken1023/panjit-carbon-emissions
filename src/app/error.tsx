"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold text-destructive">頁面載入錯誤</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          此頁面發生錯誤，請嘗試重新載入。
        </p>
        <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs">
          {error.message}
          {error.digest && `\nDigest: ${error.digest}`}
        </pre>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          重新載入
        </button>
      </div>
    </div>
  );
}
