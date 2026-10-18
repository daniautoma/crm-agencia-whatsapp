import { prisma } from "@/lib/prisma";
import { getOpenRouterClient } from "./openrouter";
import { CLINICAL_SYSTEM_PROMPT } from "./prompts";
import { AI_TOOLS, executeAiTool } from "./tools";
import { baileysService } from "@/lib/whatsapp/baileys";
import { whatsappEvents, WhatsAppEventTypes } from "@/lib/whatsapp/events";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Buffer de ráfagas en memoria: mapa de conversationId -> { timer: NodeJS.Timeout, messages: string[] }
const messageBuffers = new Map<string, { timer: NodeJS.Timeout; messages: string[] }>();

/**
 * Encola un mensaje entrante de WhatsApp en el buffer de 8 segundos.
 * Si el paciente envía varios mensajes seguidos, se concatenan y se procesan juntos.
 */
export async function queueIncomingMessageForAi(
  conversationId: string,
  patientPhone: string,
  incomingText: string
) {
  // 1. Verificar si la IA está activa para esta conversación y globalmente
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || !conversation.isAiActive) {
    return; // Si el humano tomó el control, la IA no interviene
  }

  const clinicConfig = await prisma.clinicConfig.findFirst();
  if (clinicConfig && !clinicConfig.aiIsGloballyActive) {
    return; // Pausado globalmente
  }

  const bufferSeconds = clinicConfig?.aiBufferSeconds || 8;

  // 2. Gestionar buffer
  const existing = messageBuffers.get(conversationId);
  if (existing) {
    clearTimeout(existing.timer);
    existing.messages.push(incomingText);
    existing.timer = setTimeout(() => {
      processBufferedMessages(conversationId, patientPhone);
    }, bufferSeconds * 1000);
  } else {
    const timer = setTimeout(() => {
      processBufferedMessages(conversationId, patientPhone);
    }, bufferSeconds * 1000);

    messageBuffers.set(conversationId, {
      timer,
      messages: [incomingText],
    });
  }
}

/**
 * Procesa el lote de mensajes acumulados en el buffer invocando al agente OpenRouter
 */
async function processBufferedMessages(conversationId: string, patientPhone: string) {
  const buffered = messageBuffers.get(conversationId);
  messageBuffers.delete(conversationId);

  if (!buffered || buffered.messages.length === 0) return;

  // Re-verificar si la IA sigue activa
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { patient: true },
  });

  if (!conversation || !conversation.isAiActive) return;

  const clinicConfig = await prisma.clinicConfig.findFirst();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn("[AI AGENT] No hay OPENROUTER_API_KEY configurada. Saltando respuesta de IA.");
    return;
  }

  const model = clinicConfig?.aiModel || process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const systemPrompt = clinicConfig?.aiSystemPrompt || CLINICAL_SYSTEM_PROMPT;

  try {
    // 1. Obtener historial reciente de mensajes de la conversación
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    recentMessages.reverse();

    // 2. Construir mensajes para el modelo
    const messagesForModel: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of recentMessages) {
      if (msg.senderType === "PATIENT") {
        messagesForModel.push({ role: "user", content: msg.text });
      } else if (msg.senderType === "AI" || msg.senderType === "AGENT") {
        messagesForModel.push({ role: "assistant", content: msg.text });
      }
    }

    const openai = getOpenRouterClient(apiKey);

    // 3. Primer llamado al modelo con Tools
    let response = await openai.chat.completions.create({
      model,
      messages: messagesForModel,
      tools: AI_TOOLS,
      tool_choice: "auto",
      temperature: clinicConfig?.aiTemperature ?? 0.2,
      max_tokens: 1000,
    });

    let choice = response.choices[0];

    // 4. Bucle de ejecución de herramientas (Function Calling)
    while (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      messagesForModel.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const toolName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args = {};
        }

        console.log(`🤖 [AI AGENT TOOL] Ejecutando: ${toolName}`, args);

        const executionResult = await executeAiTool(toolName, args, {
          conversationId,
          patientPhone,
        });

        // Registrar nota interna para trazabilidad
        const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
        if (adminUser) {
          await prisma.internalNote.create({
            data: {
              conversationId,
              userId: adminUser.id,
              content: `🤖 [Herramienta ejecutada]: ${toolName} -> ${JSON.stringify(executionResult.data || executionResult.error)}`,
            },
          });
        }

        messagesForModel.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(executionResult),
        });
      }

      response = await openai.chat.completions.create({
        model,
        messages: messagesForModel,
        tools: AI_TOOLS,
        tool_choice: "auto",
        temperature: clinicConfig?.aiTemperature ?? 0.2,
        max_tokens: 1000,
      });

      choice = response.choices[0];
    }

    const finalAnswer = choice.message.content?.trim();

    if (finalAnswer) {
      // 5. Guardar mensaje de la IA en la base de datos
      const savedAiMsg = await prisma.message.create({
        data: {
          conversationId,
          text: finalAnswer,
          senderType: "AI",
          senderName: "Asistente Virtual Dra. Bianca",
          status: "DELIVERED",
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
        },
      });

      // 6. Enviar mensaje real a WhatsApp vía Baileys
      if (conversation.whatsappJid) {
        await baileysService.sendMessage(conversation.whatsappJid, finalAnswer);
      }

      // 7. Notificar a las pantallas del Dashboard / Buzón vía SSE
      whatsappEvents.emit(WhatsAppEventTypes.NEW_MESSAGE, {
        conversationId,
        message: savedAiMsg,
        patient: {
          id: conversation.patient.id,
          fullName: conversation.patient.fullName,
          phoneNormalized: conversation.patient.phoneNormalized,
        },
      });

      whatsappEvents.emit(WhatsAppEventTypes.CONVERSATION_UPDATED, {
        conversationId,
        lastMessageText: finalAnswer,
        lastMessageAt: new Date(),
      });
    }
  } catch (err: any) {
    console.error("[AI AGENT ERROR]:", err);
  }
}
