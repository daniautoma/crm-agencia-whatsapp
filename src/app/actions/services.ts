'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';

const serviceSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  category: z.string().min(2, 'La categoría es requerida'),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().min(10, 'La duración mínima es de 10 minutos'),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  isPriceVariable: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function createServiceAction(formData: FormData) {
  const session = await requireRole(['ADMIN']);

  const raw = {
    name: formData.get('name') as string,
    category: (formData.get('category') as string) || 'General',
    description: (formData.get('description') as string) || '',
    durationMinutes: formData.get('durationMinutes'),
    price: formData.get('price'),
    isPriceVariable: formData.get('isPriceVariable') === 'true',
    isActive: formData.get('isActive') !== 'false',
  };

  const parsed = serviceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues?.[0]?.message || 'Datos de servicio inválidos' };
  }

  try {
    const service = await prisma.service.create({
      data: parsed.data,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'CREATE_SERVICE',
        entity: 'Service',
        entityId: service.id,
        details: JSON.stringify(service),
      },
    });

    revalidatePath('/services');
    revalidatePath('/calendar');
    return { success: true, service };
  } catch (err: unknown) {
    console.error('Error al crear servicio:', err);
    return { error: 'No se pudo crear el servicio en el sistema.' };
  }
}

export async function updateServiceAction(serviceId: string, formData: FormData) {
  const session = await requireRole(['ADMIN']);

  const raw = {
    name: formData.get('name') as string,
    category: (formData.get('category') as string) || 'General',
    description: (formData.get('description') as string) || '',
    durationMinutes: formData.get('durationMinutes'),
    price: formData.get('price'),
    isPriceVariable: formData.get('isPriceVariable') === 'true',
    isActive: formData.get('isActive') === 'true',
  };

  const parsed = serviceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues?.[0]?.message || 'Datos de servicio inválidos' };
  }

  try {
    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: parsed.data,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: 'UPDATE_SERVICE',
        entity: 'Service',
        entityId: serviceId,
        details: JSON.stringify(updated),
      },
    });

    revalidatePath('/services');
    revalidatePath('/calendar');
    return { success: true, service: updated };
  } catch (err: unknown) {
    console.error('Error al actualizar servicio:', err);
    return { error: 'No se pudo actualizar el servicio.' };
  }
}

export async function toggleServiceStatusAction(serviceId: string) {
  await requireRole(['ADMIN']);

  try {
    const current = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!current) return { error: 'Servicio no encontrado' };

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: !current.isActive },
    });

    revalidatePath('/services');
    return { success: true, isActive: updated.isActive };
  } catch (err: unknown) {
    console.error('Error al alternar estado del servicio:', err);
    return { error: 'Error al cambiar el estado del servicio' };
  }
}
