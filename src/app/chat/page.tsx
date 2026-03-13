import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChatPage } from "./chat-page";

export default async function ChatRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ChatPage userName={user.name} />;
}
