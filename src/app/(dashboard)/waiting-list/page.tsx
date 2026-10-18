import React from 'react';
import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { Clock, Plus } from 'lucide-react';
import { formatSVPhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function WaitingListPage() {
  await requireRole(['ADMIN', 'RECEPTIONIST']);

  const waitingItems = await prisma.waitingList.findMany({
    include: {
      patient: true,
      preferredService: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Lista de Espera y Cancelaciones
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Clientes y prospectos interesados en llamadas anticipadas ante la liberación de espacios en la agenda.
          </p>
        </div>

        <button className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-xs flex items-center gap-1.5 self-start sm:self-auto">
          <Plus className="w-3.5 h-3.5" />
          Registrar en Espera
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        {waitingItems.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No hay clientes en lista de espera</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Cuando un cliente solicite un espacio anticipado o haya cancelaciones de llamadas, se podrán asignar turnos desde aquí.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {waitingItems.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-slate-900">{item.patient.fullName}</div>
                  <div className="text-[11px] text-slate-400">{formatSVPhone(item.patient.phoneNormalized)}</div>
                </div>
                <span className="badge badge-warning">En Espera</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
