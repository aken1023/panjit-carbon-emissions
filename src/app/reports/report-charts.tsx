"use client";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Types for chart data
export interface MonthlyData {
  month: string;
  scope1: number;
  scope2: number;
}

export interface CategoryData {
  name: string;
  value: number;
}

export interface ScopeData {
  name: string;
  value: number;
}

const SCOPE_COLORS = {
  scope1: "#f97316", // orange
  scope2: "#3b82f6", // blue
};

const CATEGORY_COLORS = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
];

function formatTooltipValue(value: number) {
  return `${value.toFixed(2)} tCO₂e`;
}

export function MonthlyEmissionsChart({ data }: { data: MonthlyData[] }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-base font-semibold">月排放趨勢圖</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            stroke="var(--color-muted-foreground, #6b7280)"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="var(--color-muted-foreground, #6b7280)"
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
          />
          <Tooltip
            formatter={formatTooltipValue}
            contentStyle={{
              backgroundColor: "var(--color-card, #fff)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "13px" }}
          />
          <Bar
            dataKey="scope1"
            name="範疇一"
            stackId="a"
            fill={SCOPE_COLORS.scope1}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="scope2"
            name="範疇二"
            stackId="a"
            fill={SCOPE_COLORS.scope2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryPieChart({ data }: { data: CategoryData[] }) {
  const filteredData = data.filter((d) => d.value > 0);

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-base font-semibold">排放類別佔比</h3>
      {filteredData.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          尚無資料
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(1)}%`
              }
              labelLine={{ strokeWidth: 1 }}
            >
              {filteredData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={formatTooltipValue} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function ScopePieChart({ data }: { data: ScopeData[] }) {
  const filteredData = data.filter((d) => d.value > 0);
  const scopeColors = [SCOPE_COLORS.scope1, SCOPE_COLORS.scope2];

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-base font-semibold">範疇佔比</h3>
      {filteredData.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          尚無資料
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(1)}%`
              }
              labelLine={{ strokeWidth: 1 }}
            >
              {filteredData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={scopeColors[index % scopeColors.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={formatTooltipValue} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
