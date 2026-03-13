"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Period = {
  id: string;
  name: string;
  year: number;
};

export function PeriodSelector({
  periods,
  selectedPeriodId,
}: {
  periods: Period[];
  selectedPeriodId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodId", e.target.value);
    router.push(`/data-entry?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="periodSelect" className="text-sm font-medium whitespace-nowrap">
        盤查期間
      </label>
      <select
        id="periodSelect"
        value={selectedPeriodId}
        onChange={handleChange}
        className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.name}（{period.year}）
          </option>
        ))}
      </select>
    </div>
  );
}
