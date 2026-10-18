'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';

const appointmentCreateSchema = z.object({
  patientId: z.string().min(1, 'El paciente es obligatorio'),
  professionalId: z.string().min(1, 'El odontólogo es obligatorio'),
  serviceId: z.string().min(1, 'El servicio es obligatorio'),
  startTime: z.string().datetime({ message: 'Fecha y hora de inicio inválida' }),
  adminNotes: z.string().optional(),
  origin: z.enum(['WHATSAPP_AI', 'RECEPTION', 'MANUAL']).default('MANUAL'),
});

/**
 * Función atómica centralizada con verificación estricta anti-colisión
 */
export async function reservarCitaSegura(data: {
  patientId: string;
  professionalId: string;
  serviceId: string;
  startTime: Date;
  endTime: Date;
  origin?: string;
  adminNotes?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validar solapamiento con cualquier cita activa del mismo profesional
    const conflicto = await tx.appointment.findFirst({
      where: {
        professionalId: data.professionalId,
        status: { in: ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'] },
        AND: [
          { startTime: { lt: data.endTime } },
          { endTime: { gt: data.startTime } },
        ],
      },
      include: {
        patient: { select: { fullName: true } },
        service: { select: { name: true } },
      },
    });

    if (conflicto) {
      const confStart = new Intl.DateTimeFormat('es-SV', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/El_Salvador',
      }).format(conflicto.startTime);

      const confEnd = new Intl.DateTimeFormat('es-SV', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/El_Salvador',
      }).format(conflicto.endTime);

      throw new Error(
        `CONFLICTO_HORARIO: El odontólogo ya tiene reservada la cita "${conflicto.service.name}" para ${conflicto.patient.fullName} de ${confStart} a ${confEnd}.`
      );
    }

    // 2. Crear la cita atómicamente
    return await tx.appointment.create({
      data: {
        patientId: data.patientId,
        professionalId: data.professionalId,
        serviceId: data.serviceId,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'CONFIRMED',
        origin: data.origin || 'RECEPTION',
        adminNotes: data.adminNotes,
      },
      include: {
        patient: true,
        service: true,
        professional: { select: { name: true } },
      },
    });
  });
}

export async function createAppointmentAction(formData: FormData) {
  const session = await requireAuth();

  const raw = {
    patientId: formData.get('patientId') as string,
    professionalId: formData.get('professionalId') as string,
    serviceId: formData.get('serviceId') as string,
    startTime: formData.get('startTime') as string,
    adminNotes: (formData.get('adminNotes') as string) || undefined,
    origin: (formData.get('origin') as 'WHATSAPP_AI' | 'RECEPTION' | 'MANUAL') || 'RECEPTION',
  };

  const parsed = appointmentCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues?.[0]?.message || 'Datos de reserva incompletos' };
  }

  try {
    // Obtener duración del servicio
    const service = await prisma.service.findUnique({
      where: { id: parsed.data.serviceId },
    });

    if (!service) {
      return { error: 'Servicio no encontrado en el catálogo' };
    }

    const start = new Date(parsed.data.startTime);
    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

    const appointment = await reservarCitaSegura({
      patientId: parsed.data.patientId,
      professionalId: parsed.data.professionalId,
      serviceId: parsed.data.serviceId,
      startTime: start,
      endTime: end,
      origin: parsed.data.origin,
      adminNotes: parsed.data.adminNotes,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE_APPOINTMENT',
        entity: 'Appointment',
        entityId: appointment.id,
        details: JSON.stringify({
          patient: appointment.patient.fullName,
          service: appointment.service.name,
          startTime: start,
          endTime: end,
        }),
      },
    });

    revalidatePath('/calendar');
    revalidatePath('/dashboard');
    revalidatePath('/patients');
    return { success: true, appointment };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al agendar la cita.';
    return { error: message };
  }
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  newStatus: 'REQUESTED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW',
  cancelReason?: string
) {
  const session = await requireAuth();

  try {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: newStatus,
        cancelReason: cancelReason || null,
      },
      include: {
        patient: true,
        service: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: `APPOINTMENT_STATUS_${newStatus}`,
        entity: 'Appointment',
        entityId: appointmentId,
        details: JSON.stringify({ status: newStatus, cancelReason }),
      },
    });

    revalidatePath('/calendar');
    revalidatePath('/dashboard');
    return { success: true, appointment: updated };
  } catch (err: unknown) {
    console.error('Error al actualizar estado de la cita:', err);
    return { error: 'No se pudo actualizar el estado de la cita.' };
  }
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  newStartTimeISO: string
) {
  const session = await requireAuth();

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true },
    });

    if (!appointment) return { error: 'Cita no encontrada' };

    const newStart = new Date(newStartTimeISO);
    const newEnd = new Date(newStart.getTime() + appointment.service.durationMinutes * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      // Validar colisión ignorando la propia cita actual
      const conflicto = await tx.appointment.findFirst({
        where: {
          id: { not: appointmentId },
          professionalId: appointment.professionalId,
          status: { in: ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'] },
          AND: [
            { startTime: { lt: newEnd } },
            { endTime: { gt: newStart } },
          ],
        },
      });

      if (conflicto) {
        throw new Error('El nuevo horario solicitado colisiona con otra cita ya agendada para el odontólogo.');
      }

      return await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          startTime: newStart,
          endTime: newEnd,
          status: 'CONFIRMED',
        },
        include: { patient: true, service: true },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'RESCHEDULE_APPOINTMENT',
        entity: 'Appointment',
        entityId: appointmentId,
        details: JSON.stringify({ newStart, newEnd }),
      },
    });

    revalidatePath('/calendar');
    revalidatePath('/dashboard');
    return { success: true, appointment: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al reprogramar la cita';
    return { error: message };
  }
}
