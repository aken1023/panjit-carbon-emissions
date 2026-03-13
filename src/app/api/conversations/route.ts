import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/conversations — list user's conversations
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "未登入" }, { status: 401 });

  const conversations = await prisma.chatConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true },
      },
    },
    take: 50,
  });

  return Response.json(
    conversations.map((c) => ({
      id: c.id,
      title: c.title,
      updatedAt: c.updatedAt.toISOString(),
      lastMessage: c.messages[0]?.content?.slice(0, 80) ?? "",
    }))
  );
}

// POST /api/conversations — create new conversation
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "未登入" }, { status: 401 });

  const body = await request.json();
  const title = body.title || "新對話";

  const conversation = await prisma.chatConversation.create({
    data: { userId: user.id, title },
  });

  return Response.json({ id: conversation.id, title: conversation.title });
}
