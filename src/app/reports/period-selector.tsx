"use client";

import { useRouter } from "next/navigation";

interface Period {
  id: string;
  name: string;
  year: number;
}

export function PeriodSelector({
  periods,
  selectedId,
}: {
  periods: Period[];
  selectedId: string | null;
}) {
  const router = useRouter();

  return (
    <select
      className="rounded-lg border bg-card px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
      value={selectedId ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        if (val) {
          router.push(`/reports?periodId=${val}`);
        } else {
          router.push("/reports");
        }
      }}
    >
      <option value="">選擇盤查期間</option>
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.year})
        </option>
      ))}
    </select>
  );
}
