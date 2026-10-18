import React from 'react';
import { requireAuth } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { CalendarManager } from '@/components/calendar/CalendarManager';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const session = await requireAuth();

  const appointmentWhere: Record<string, unknown> = {};
  if (session.role === 'DENTIST') {
    appointmentWhere.professionalId = session.userId;
  }

  const [appointments, services, dentists, patients] = await Promise.all([
    prisma.appointment.findMany({
      where: appointmentWhere,
      include: {
        patient: {
          select: { fullName: true, phoneNormalized: true },
        },
        service: {
          select: { name: true, durationMinutes: true, price: true },
        },
        professional: {
          select: { name: true },
        },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        durationMinutes: true,
        price: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: 'DENTIST', isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.patient.findMany({
      select: { id: true, fullName: true, phoneNormalized: true },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Calendario Odontológico y Gestión de Citas
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Agenda de turnos con garantía de cero solapamiento mediante verificación transaccional atómica.
        </p>
      </div>

      <CalendarManager
        initialAppointments={appointments}
        services={services}
        dentists={dentists}
        patients={patients}
        userRole={session.role}
        currentUserId={session.userId}
      />
    </div>
  );
}
