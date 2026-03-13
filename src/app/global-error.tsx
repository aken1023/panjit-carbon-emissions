"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-TW">
      <body>
        <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <h1 style={{ color: "#dc2626" }}>系統錯誤</h1>
          <p style={{ color: "#666", marginBottom: "1rem" }}>
            發生未預期的錯誤，請嘗試重新載入。
          </p>
          <pre
            style={{
              background: "#f5f5f5",
              padding: "1rem",
              borderRadius: "8px",
              overflow: "auto",
              fontSize: "13px",
              maxHeight: "300px",
            }}
          >
            {error.message}
            {error.digest && `\nDigest: ${error.digest}`}
            {error.stack && `\n\n${error.stack}`}
          </pre>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            重新載入
          </button>
        </div>
      </body>
    </html>
  );
}
