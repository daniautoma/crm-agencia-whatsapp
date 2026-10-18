'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';

function normalizeElSalvadorPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('503') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.length === 8) {
    return `+503${digits}`;
  }
  if (digits.length > 8 && !digits.startsWith('503')) {
    return `+${digits}`;
  }
  return `+503${digits}`;
}

const patientSchema = z.object({
  fullName: z.string().min(3, 'El nombre completo debe tener al menos 3 caracteres'),
  phone: z.string().min(8, 'El número de teléfono debe tener al menos 8 dígitos'),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  tags: z.string().default('Nuevo'),
  generalNotes: z.string().optional(),
  reminderPreference: z.enum(['WHATSAPP', 'EMAIL', 'NONE']).default('WHATSAPP'),
});

export async function createPatientAction(formData: FormData) {
  const session = await requireAuth();

  const raw = {
    fullName: formData.get('fullName') as string,
    phone: formData.get('phone') as string,
    email: (formData.get('email') as string) || undefined,
    birthDate: (formData.get('birthDate') as string) || undefined,
    tags: (formData.get('tags') as string) || 'Nuevo',
    generalNotes: (formData.get('generalNotes') as string) || '',
    reminderPreference: (formData.get('reminderPreference') as 'WHATSAPP' | 'EMAIL' | 'NONE') || 'WHATSAPP',
  };

  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues?.[0]?.message || 'Datos del paciente inválidos' };
  }

  const phoneNormalized = normalizeElSalvadorPhone(parsed.data.phone);

  try {
    // Verificar si el teléfono ya existe
    const existing = await prisma.patient.findUnique({
      where: { phoneNormalized },
    });

    if (existing) {
      return {
        error: `Ya existe un paciente registrado con el teléfono ${phoneNormalized} (${existing.fullName}).`,
        existingPatientId: existing.id,
      };
    }

    const patient = await prisma.patient.create({
      data: {
        fullName: parsed.data.fullName.trim(),
        phoneNormalized,
        email: parsed.data.email || null,
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
        tags: parsed.data.tags,
        generalNotes: parsed.data.generalNotes,
        reminderPreference: parsed.data.reminderPreference,
      },
    });

    // Crear conversación inicial de WhatsApp vinculada para que aparezca en la bandeja
    const whatsappJid = `${phoneNormalized.replace('+', '')}@s.whatsapp.net`;
    await prisma.conversation.upsert({
      where: { whatsappJid },
      create: {
        patientId: patient.id,
        whatsappJid,
        status: 'OPEN',
        isAiActive: true,
      },
      update: {},
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE_PATIENT',
        entity: 'Patient',
        entityId: patient.id,
        details: JSON.stringify({ fullName: patient.fullName, phoneNormalized }),
      },
    });

    revalidatePath('/patients');
    revalidatePath('/calendar');
    revalidatePath('/dashboard');
    return { success: true, patient };
  } catch (err: unknown) {
    console.error('Error al registrar paciente:', err);
    return { error: 'Ocurrió un error al registrar el paciente en la base de datos.' };
  }
}

export async function updatePatientAction(patientId: string, formData: FormData) {
  const session = await requireAuth();

  const raw = {
    fullName: formData.get('fullName') as string,
    phone: formData.get('phone') as string,
    email: (formData.get('email') as string) || undefined,
    birthDate: (formData.get('birthDate') as string) || undefined,
    tags: (formData.get('tags') as string) || 'Nuevo',
    generalNotes: (formData.get('generalNotes') as string) || '',
    reminderPreference: (formData.get('reminderPreference') as 'WHATSAPP' | 'EMAIL' | 'NONE') || 'WHATSAPP',
  };

  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues?.[0]?.message || 'Datos del paciente inválidos' };
  }

  const phoneNormalized = normalizeElSalvadorPhone(parsed.data.phone);

  try {
    // Validar duplicado en otro paciente
    const duplicate = await prisma.patient.findFirst({
      where: {
        phoneNormalized,
        NOT: { id: patientId },
      },
    });

    if (duplicate) {
      return { error: `El número ${phoneNormalized} ya pertenece a otro paciente (${duplicate.fullName}).` };
    }

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: {
        fullName: parsed.data.fullName.trim(),
        phoneNormalized,
        email: parsed.data.email || null,
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
        tags: parsed.data.tags,
        generalNotes: parsed.data.generalNotes,
        reminderPreference: parsed.data.reminderPreference,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE_PATIENT',
        entity: 'Patient',
        entityId: patientId,
        details: JSON.stringify(updated),
      },
    });

    revalidatePath('/patients');
    revalidatePath('/calendar');
    return { success: true, patient: updated };
  } catch (err: unknown) {
    console.error('Error al actualizar paciente:', err);
    return { error: 'No se pudo actualizar la información del paciente.' };
  }
}

export async function getPatientDetailsAction(patientId: string) {
  await requireAuth();

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        appointments: {
          include: {
            service: true,
            professional: { select: { name: true } },
          },
          orderBy: { startTime: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!patient) return { error: 'Paciente no encontrado' };
    return { success: true, patient };
  } catch (err: unknown) {
    console.error('Error al obtener ficha de paciente:', err);
    return { error: 'Error al consultar la ficha clínica' };
  }
}
