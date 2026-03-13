import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/chat");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">碳排管理系統</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            企業溫室氣體盤查與碳管理平台
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
