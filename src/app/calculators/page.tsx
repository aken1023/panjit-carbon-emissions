import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CalculatorsPage } from "./calculators-page";

export default async function CalculatorsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <CalculatorsPage />;
}
