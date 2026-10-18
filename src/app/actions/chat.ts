'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/rbac';
import { baileysService } from '@/lib/whatsapp/baileys';
import { whatsappEvents, WhatsAppEventTypes } from '@/lib/whatsapp/events';
import { revalidatePath } from 'next/cache';

const messageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().min(1, 'El mensaje no puede estar vacío'),
});

/**
 * Enviar mensaje manual de agente humano con aplicación de la Regla de Oro (Pausar IA)
 */
export async function sendAgentMessageAction(formData: FormData) {
  const session = await requireAuth();

  const raw = {
    conversationId: formData.get('conversationId') as string,
    text: formData.get('text') as string,
  };

  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues?.[0]?.message || 'Mensaje inválido' };
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: parsed.data.conversationId },
      include: { patient: true },
    });

    if (!conversation) {
      return { error: 'Conversación no encontrada' };
    }

    // 1. Enviar mensaje por el socket de Baileys
    const sentOk = await baileysService.sendMessage(
      conversation.whatsappJid,
      parsed.data.text.trim()
    );

    // 2. Registrar el mensaje en la base de datos
    const savedMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'AGENT',
        senderName: session.name,
        text: parsed.data.text.trim(),
        status: sentOk ? 'SENT' : 'FAILED',
      },
    });

    // 3. REGLA DE ORO DE CONCURRENCIA: Pausar automáticamente la IA en este chat
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        isAiActive: false, // ¡IA PAUSADA!
        status: 'PENDING_HUMAN',
        lastMessageAt: new Date(),
        assignedUserId: conversation.assignedUserId || session.userId,
      },
      include: {
        patient: true,
      },
    });

    // 4. Registrar en notas internas la intervención
    await prisma.internalNote.create({
      data: {
        conversationId: conversation.id,
        userId: session.userId,
        content: `Intervención manual de ${session.name}. IA pausada automáticamente en esta conversación.`,
      },
    });

    // 5. Emitir eventos en tiempo real para todos los operadores conectados
    whatsappEvents.emit(WhatsAppEventTypes.NEW_MESSAGE, {
      conversationId: conversation.id,
      message: savedMessage,
      patient: conversation.patient,
    });

    whatsappEvents.emit(WhatsAppEventTypes.CONVERSATION_UPDATED, {
      conversationId: conversation.id,
      lastMessageText: savedMessage.text,
      lastMessageAt: savedMessage.createdAt,
      isAiActive: false,
      status: 'PENDING_HUMAN',
    });

    revalidatePath('/chat');
    return { success: true, message: savedMessage };
  } catch (err: unknown) {
    console.error('Error enviando mensaje de agente:', err);
    return { error: 'No se pudo enviar el mensaje a través de WhatsApp.' };
  }
}

/**
 * Añadir nota interna privada para el equipo clínico
 */
export async function addInternalNoteAction(conversationId: string, content: string) {
  const session = await requireAuth();

  if (!content.trim()) return { error: 'La nota no puede estar vacía' };

  try {
    const note = await prisma.internalNote.create({
      data: {
        conversationId,
        userId: session.userId,
        content: content.trim(),
      },
      include: {
        user: { select: { name: true, role: true } },
      },
    });

    revalidatePath('/chat');
    return { success: true, note };
  } catch (err: unknown) {
    console.error('Error al agregar nota interna:', err);
    return { error: 'No se pudo guardar la nota interna.' };
  }
}

/**
 * Reactivar o pausar la IA manualmente
 */
export async function toggleConversationAiAction(conversationId: string, isAiActive: boolean) {
  const session = await requireAuth();

  try {
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isAiActive,
        status: isAiActive ? 'OPEN' : 'PENDING_HUMAN',
      },
    });

    // Registrar en notas internas
    await prisma.internalNote.create({
      data: {
        conversationId,
        userId: session.userId,
        content: isAiActive
          ? `IA reactivada manualmente por ${session.name}. El asistente virtual retomará las respuestas.`
          : `IA pausada manualmente por ${session.name}.`,
      },
    });

    whatsappEvents.emit(WhatsAppEventTypes.CONVERSATION_UPDATED, {
      conversationId,
      isAiActive,
      status: updated.status,
    });

    revalidatePath('/chat');
    return { success: true, isAiActive: updated.isAiActive };
  } catch (err: unknown) {
    console.error('Error alternando IA en conversación:', err);
    return { error: 'Error al cambiar estado de la IA.' };
  }
}

/**
 * Cambiar estado de la conversación (OPEN, PENDING_HUMAN, RESOLVED)
 */
export async function updateConversationStatusAction(conversationId: string, status: string) {
  await requireAuth();

  try {
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });

    whatsappEvents.emit(WhatsAppEventTypes.CONVERSATION_UPDATED, {
      conversationId,
      status: updated.status,
    });

    revalidatePath('/chat');
    return { success: true, status: updated.status };
  } catch (err: unknown) {
    console.error('Error actualizando estado de conversación:', err);
    return { error: 'Error al actualizar estado.' };
  }
}
