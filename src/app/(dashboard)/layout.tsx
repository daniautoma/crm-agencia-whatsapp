import React from 'react';
import { requireAuth } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  // Obtener estado de WhatsApp y conteo de chats pendientes
  const clinicConfig = await prisma.clinicConfig.findUnique({
    where: { id: 'clinic_default' },
    select: { whatsappSessionStatus: true },
  });

  const unreadCount = await prisma.conversation.count({
    where: { status: 'PENDING_HUMAN' },
  });

  const whatsappStatus = (clinicConfig?.whatsappSessionStatus as
    | 'CONNECTED'
    | 'DISCONNECTED'
    | 'SCAN_QR'
    | 'CONNECTING') || 'DISCONNECTED';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Fija */}
      <Sidebar
        user={session}
        unreadChatsCount={unreadCount}
        whatsappStatus={whatsappStatus}
      />

      {/* Área Principal de Contenido */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Header userRole={session.role} />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
