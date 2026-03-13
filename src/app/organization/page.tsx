import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateUnitForm, DeleteUnitButton } from "./unit-form";

export default async function OrganizationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    include: {
      units: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              emissionSources: { where: { isActive: true } },
              children: { where: { isActive: true } },
            },
          },
        },
      },
    },
  });

  const BOUNDARY_LABELS: Record<string, string> = {
    EQUITY_SHARE: "股權法",
    FINANCIAL_CONTROL: "財務控制權法",
    OPERATIONAL_CONTROL: "營運控制權法",
  };

  const TYPE_LABELS: Record<string, string> = {
    SUBSIDIARY: "子公司",
    PLANT: "廠區",
    DEPARTMENT: "部門",
  };

  const unitsList = (org?.units || []).map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">組織管理</h1>
          <p className="text-muted-foreground">管理組織架構與盤查邊界</p>
        </div>
        <CreateUnitForm existingUnits={unitsList} />
      </div>

      {/* Organization info */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{org?.name}</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">統一編號：</span>
            <span className="font-medium">{org?.taxId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">產業類別：</span>
            <span className="font-medium">{org?.industry || "未設定"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">邊界方法：</span>
            <span className="font-medium">
              {BOUNDARY_LABELS[org?.boundaryMethod ?? ""] || "未設定"}
            </span>
          </div>
        </div>
      </div>

      {/* Organization units */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">組織單位</h2>
        {org?.units.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="text-muted-foreground">尚未建立組織單位</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {org?.units.map((unit) => {
              const canDelete =
                unit._count.emissionSources === 0 && unit._count.children === 0;
              return (
                <div key={unit.id} className="rounded-xl border bg-card p-4">
                  <p className="font-medium">{unit.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {TYPE_LABELS[unit.type] || unit.type}
                    {unit.equityShare < 100 && ` (持股 ${unit.equityShare}%)`}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <DeleteUnitButton id={unit.id} disabled={!canDelete} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
