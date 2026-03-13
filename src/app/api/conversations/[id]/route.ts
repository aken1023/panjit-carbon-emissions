import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/conversations/[id] — get conversation messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "未登入" }, { status: 401 });

  const { id } = await params;

  const conversation = await prisma.chatConversation.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          promptTokens: true,
          completionTokens: true,
          costNtd: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation)
    return Response.json({ error: "對話不存在" }, { status: 404 });

  return Response.json({
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      promptTokens: m.promptTokens,
      completionTokens: m.completionTokens,
      costNtd: m.costNtd,
      timestamp: m.createdAt.toISOString(),
    })),
  });
}

// POST /api/conversations/[id] — add message to conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "未登入" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Verify ownership
  const convo = await prisma.chatConversation.findFirst({
    where: { id, userId: user.id },
  });
  if (!convo)
    return Response.json({ error: "對話不存在" }, { status: 404 });

  const message = await prisma.chatMessage.create({
    data: {
      conversationId: id,
      role: body.role,
      content: body.content,
      promptTokens: body.promptTokens ?? 0,
      completionTokens: body.completionTokens ?? 0,
      costNtd: body.costNtd ?? 0,
    },
  });

  // Auto-update title from first user message
  if (body.role === "user") {
    const msgCount = await prisma.chatMessage.count({
      where: { conversationId: id },
    });
    if (msgCount <= 1) {
      await prisma.chatConversation.update({
        where: { id },
        data: { title: body.content.slice(0, 60) },
      });
    }
  }

  // Touch updatedAt
  await prisma.chatConversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return Response.json({ id: message.id });
}

// DELETE /api/conversations/[id] — delete conversation
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "未登入" }, { status: 401 });

  const { id } = await params;

  const convo = await prisma.chatConversation.findFirst({
    where: { id, userId: user.id },
  });
  if (!convo)
    return Response.json({ error: "對話不存在" }, { status: 404 });

  await prisma.chatConversation.delete({ where: { id } });
  return Response.json({ ok: true });
}
