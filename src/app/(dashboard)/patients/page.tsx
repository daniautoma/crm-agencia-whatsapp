import React from 'react';
import { requireAuth } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { PatientsManager } from '@/components/patients/PatientsManager';

export const dynamic = 'force-dynamic';

export default async function PatientsPage() {
  await requireAuth();

  const patients = await prisma.patient.findMany({
    include: {
      _count: {
        select: { appointments: true, conversations: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Directorio de Pacientes
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Gestión integral de pacientes con normalización telefónica (+503 El Salvador) y seguimiento clínico.
        </p>
      </div>

      <PatientsManager initialPatients={patients} />
    </div>
  );
}
