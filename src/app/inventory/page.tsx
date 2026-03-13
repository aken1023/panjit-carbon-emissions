import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateInventoryForm, DeleteInventoryButton } from "./inventory-form";

export default async function InventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const periods = await prisma.inventoryPeriod.findMany({
    where: { orgId: user.orgId },
    orderBy: { year: "desc" },
    include: { _count: { select: { activityData: true } } },
  });

  const STATUS_LABELS: Record<string, string> = {
    OPEN: "進行中",
    IN_REVIEW: "審查中",
    VERIFIED: "已查核",
    LOCKED: "已鎖定",
  };

  const STATUS_COLORS: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700",
    IN_REVIEW: "bg-yellow-100 text-yellow-700",
    VERIFIED: "bg-green-100 text-green-700",
    LOCKED: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">碳盤查管理</h1>
          <p className="text-muted-foreground">管理年度盤查期間與排放源清單</p>
        </div>
        <CreateInventoryForm />
      </div>

      {periods.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚未建立盤查期間
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            點擊上方按鈕建立第一個年度盤查期間
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((period) => {
            const canDelete = period.status === "OPEN" && period._count.activityData === 0;
            return (
              <div key={period.id} className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{period.name}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[period.status]}`}
                  >
                    {STATUS_LABELS[period.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {period.year} 年度
                  {period.isBaseYear && " (基準年)"}
                </p>
                <div className="mt-3 flex justify-end">
                  <DeleteInventoryButton id={period.id} disabled={!canDelete} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
