"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ChatWidget } from "@/components/chatbot/chat-widget";

interface AppShellProps {
  userName: string;
  userRole: string;
  orgName: string;
  children: React.ReactNode;
}

export function AppShell({ userName, userRole, orgName, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={userName}
        userRole={userRole}
        orgName={orgName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 lg:ml-64">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
      <ChatWidget />
    </div>
  );
}
