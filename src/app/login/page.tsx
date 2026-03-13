import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

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

        {/* Demo accounts */}
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          <p className="mb-2 font-medium text-muted-foreground">測試帳號</p>
          <div className="space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>管理員</span>
              <span className="font-mono text-xs">admin@panjit.com / admin123</span>
            </div>
            <div className="flex justify-between">
              <span>碳管主管</span>
              <span className="font-mono text-xs">carbon@panjit.com / carbon123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
