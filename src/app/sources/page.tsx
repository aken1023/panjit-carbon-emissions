import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCOPE_LABELS, CATEGORY_LABELS } from "@/lib/emission";
import { CreateSourceForm, DeleteSourceButton } from "./source-form";

export default async function SourcesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sources = await prisma.emissionSource.findMany({
    where: {
      unit: { orgId: user.orgId },
      isActive: true,
    },
    include: {
      unit: true,
      _count: { select: { activityData: true } },
    },
    orderBy: [{ scope: "asc" }, { category: "asc" }],
  });

  const units = await prisma.organizationUnit.findMany({
    where: { orgId: user.orgId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">排放源清單</h1>
          <p className="text-muted-foreground">管理企業各範疇排放源</p>
        </div>
        <CreateSourceForm units={units} />
      </div>

      {sources.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            尚未建立排放源
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            請先建立組織架構，再新增排放源
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-4 font-medium">排放源名稱</th>
                <th className="p-4 font-medium">範疇</th>
                <th className="p-4 font-medium">排放類別</th>
                <th className="p-4 font-medium">廠區/部門</th>
                <th className="p-4 font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const canDelete = source._count.activityData === 0;
                return (
                  <tr key={source.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{source.name}</td>
                    <td className="p-4">{SCOPE_LABELS[source.scope]}</td>
                    <td className="p-4">{CATEGORY_LABELS[source.category] || source.category}</td>
                    <td className="p-4 text-muted-foreground">{source.unit.name}</td>
                    <td className="p-4">
                      <DeleteSourceButton id={source.id} disabled={!canDelete} />
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
