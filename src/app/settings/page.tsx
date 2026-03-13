import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCOPE_LABELS, CATEGORY_LABELS } from "@/lib/emission";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { UserManagementSection } from "./user-management";
import { EmissionFactorSection } from "./emission-factors";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "系統管理員",
  CARBON_MANAGER: "碳管理主管",
  DATA_ENTRY: "資料填報人",
  AUDITOR: "查核人員",
  VIEWER: "唯讀",
};

const SOURCE_LABELS: Record<string, string> = {
  EPA_TW: "環境部",
  IPCC_AR6: "IPCC AR6",
  GHG_PROTOCOL: "GHG Protocol",
  DEFRA: "DEFRA",
  CUSTOM: "自訂",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "新增",
  UPDATE: "修改",
  DELETE: "刪除",
  LOGIN: "登入",
  LOGOUT: "登出",
  EXPORT: "匯出",
};

type Tab = "users" | "factors" | "logs";

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "使用者管理" },
  { key: "factors", label: "排放係數管理" },
  { key: "logs", label: "稽核日誌" },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const activeTab = (["users", "factors", "logs"].includes(params.tab ?? "")
    ? params.tab
    : "users") as Tab;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">系統設定</h1>
        <p className="text-muted-foreground">管理使用者、排放係數與稽核日誌</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/settings?tab=${tab.key}`}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "users" && (
        <UsersTab orgId={user.orgId} isAdmin={user.role === "ADMIN"} currentUserId={user.id} />
      )}
      {activeTab === "factors" && <FactorsTab />}
      {activeTab === "logs" && <LogsTab />}
    </div>
  );
}

async function UsersTab({
  orgId,
  isAdmin,
  currentUserId,
}: {
  orgId: string;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const users = await prisma.user.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      {isAdmin && <UserManagementSection />}

      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-4 font-medium">姓名</th>
              <th className="p-4 font-medium">Email</th>
              <th className="p-4 font-medium">角色</th>
              <th className="p-4 font-medium">建立時間</th>
              {isAdmin && <th className="p-4 font-medium">操作</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-4 font-medium">{u.name}</td>
                <td className="p-4 text-muted-foreground">{u.email}</td>
                <td className="p-4">
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {ROLE_LABELS[u.role] || u.role}
                  </Badge>
                </td>
                <td className="p-4 text-muted-foreground">
                  {format(u.createdAt, "yyyy/MM/dd HH:mm")}
                </td>
                {isAdmin && (
                  <td className="p-4">
                    {u.id !== currentUserId ? (
                      <DeleteUserButton userId={u.id} userName={u.name} />
                    ) : (
                      <span className="text-xs text-muted-foreground">目前帳號</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-muted-foreground">
                  尚無使用者
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function FactorsTab() {
  const factors = await prisma.emissionFactor.findMany({
    orderBy: [{ scope: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <EmissionFactorSection />

      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-4 font-medium">名稱</th>
                <th className="p-4 font-medium">來源</th>
                <th className="p-4 font-medium">範疇</th>
                <th className="p-4 font-medium">類別</th>
                <th className="p-4 font-medium text-right">排放係數</th>
                <th className="p-4 font-medium">單位</th>
                <th className="p-4 font-medium">年度</th>
                <th className="p-4 font-medium">狀態</th>
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="p-4 font-medium">{f.name}</td>
                  <td className="p-4">
                    <Badge variant={f.source === "CUSTOM" ? "outline" : "secondary"}>
                      {SOURCE_LABELS[f.source] || f.source}
                    </Badge>
                  </td>
                  <td className="p-4">{SCOPE_LABELS[f.scope] || `範疇${f.scope}`}</td>
                  <td className="p-4">{CATEGORY_LABELS[f.category] || f.category}</td>
                  <td className="p-4 text-right font-mono">{f.totalFactor.toFixed(4)}</td>
                  <td className="p-4 text-muted-foreground">{f.unit}</td>
                  <td className="p-4 text-muted-foreground">{f.effectiveYear}</td>
                  <td className="p-4">
                    <Badge variant={f.isActive ? "default" : "outline"}>
                      {f.isActive ? "啟用" : "停用"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {factors.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    尚無排放係數資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function LogsTab() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Fetch user names for all unique userIds
  const userIds = [...new Set(logs.map((l) => l.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return (
    <div className="rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-4 font-medium">時間</th>
              <th className="p-4 font-medium">使用者</th>
              <th className="p-4 font-medium">操作</th>
              <th className="p-4 font-medium">實體</th>
              <th className="p-4 font-medium">詳情</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b last:border-0">
                <td className="p-4 whitespace-nowrap text-muted-foreground">
                  {format(log.createdAt, "yyyy/MM/dd HH:mm:ss")}
                </td>
                <td className="p-4">{userMap[log.userId] || log.userId}</td>
                <td className="p-4">
                  <Badge
                    variant={
                      log.action === "DELETE"
                        ? "destructive"
                        : log.action === "CREATE"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {ACTION_LABELS[log.action] || log.action}
                  </Badge>
                </td>
                <td className="p-4 text-muted-foreground">{log.entity}</td>
                <td className="p-4 max-w-xs truncate text-muted-foreground text-xs">
                  {log.entityId}
                  {log.ipAddress && ` (${log.ipAddress})`}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  尚無稽核日誌
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Import the client component for delete button
import { DeleteUserButton } from "./delete-user-button";
