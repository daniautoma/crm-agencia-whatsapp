import React from 'react';
import { requireAuth } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { ServicesManager } from '@/components/services/ServicesManager';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const session = await requireAuth();

  const services = await prisma.service.findMany({
    orderBy: { category: 'asc' },
  });

  const canEdit = session.role === 'ADMIN';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Catálogo de Servicios y Soluciones
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Servicios oficiales de daniautoma (Agentes IA, n8n, desarrollo web y consultoría), duraciones y tarifas autorizadas en USD ($).
        </p>
      </div>

      <ServicesManager initialServices={services} canEdit={canEdit} />
    </div>
  );
}
