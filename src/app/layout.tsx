import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "碳排管理系統 - Carbon Emissions Management",
  description: "企業溫室氣體盤查與碳管理平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  let user = null;
  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });
  }

  const isLoggedIn = !!user;

  return (
    <html lang="zh-TW">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {isLoggedIn ? (
          <AppShell
            userName={user!.name}
            userRole={user!.role}
            orgName={user!.organization.name}
          >
            {children}
          </AppShell>
        ) : (
          <main>{children}</main>
        )}
        <Toaster />
      </body>
    </html>
  );
}
