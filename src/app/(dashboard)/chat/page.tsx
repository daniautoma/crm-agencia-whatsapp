import React from 'react';
import { requireAuth } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { ChatInbox } from '@/components/chat/ChatInbox';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const session = await requireAuth();

  const conversations = await prisma.conversation.findMany({
    include: {
      patient: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      internalNotes: {
        include: {
          user: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  const serializedConversations = JSON.parse(JSON.stringify(conversations));

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Bandeja Compartida de WhatsApp
          </h1>
          <p className="text-xs text-slate-500">
            Atención multiagente estilo Chatwoot con pausa automática de IA al intervenir el personal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {conversations.length} conversación(es) activa(s)
          </span>
        </div>
      </div>

      <ChatInbox
        initialConversations={serializedConversations}
        currentUserName={session.name}
      />
    </div>
  );
}
