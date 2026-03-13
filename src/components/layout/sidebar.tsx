"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Flame,
  FileSpreadsheet,
  ClipboardList,
  BarChart3,
  Target,
  Settings,
  X,
  Leaf,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userName: string;
  userRole: string;
  orgName: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "系統管理員",
  CARBON_MANAGER: "碳管理主管",
  DATA_ENTRY: "資料填報人",
  AUDITOR: "查核人員",
  VIEWER: "唯讀",
};

const navItems = [
  { href: "/", label: "儀表板", icon: LayoutDashboard },
  { href: "/organization", label: "組織管理", icon: Building2 },
  { href: "/inventory", label: "碳盤查管理", icon: ClipboardList },
  { href: "/sources", label: "排放源清單", icon: Flame },
  { href: "/data-entry", label: "資料填報", icon: FileSpreadsheet },
  { href: "/reports", label: "揭露報告", icon: BarChart3 },
  { href: "/reduction", label: "減碳管理", icon: Target },
  { href: "/chat", label: "AI 助理", icon: MessageCircle },
  { href: "/settings", label: "系統設定", icon: Settings },
];

export function Sidebar({ userName, userRole, orgName, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Leaf className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">碳排管理系統</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t p-4">
        <p className="text-sm font-medium">{userName}</p>
        <p className="text-xs text-muted-foreground">
          {ROLE_LABELS[userRole] || userRole} - {orgName}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative z-50 h-full w-64 bg-sidebar shadow-xl">
            <button
              onClick={onMobileClose}
              className="absolute right-3 top-4 rounded-md p-1 hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
