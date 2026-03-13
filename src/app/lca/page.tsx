import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LCAPage } from "./lca-page";

export default async function LCARoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <LCAPage orgName={user.organization.name} />;
}
