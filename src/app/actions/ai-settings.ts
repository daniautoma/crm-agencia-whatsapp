'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/rbac';
import { revalidatePath } from 'next/cache';
import { getOpenRouterClient } from '@/lib/ai/openrouter';
import { CLINICAL_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { AI_TOOLS, executeAiTool } from '@/lib/ai/tools';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import fs from 'fs';
import path from 'path';

export async function updateAiConfigAction(formData: {
  aiModel?: string;
  aiTemperature?: number;
  aiBufferSeconds?: number;
  aiSystemPrompt?: string;
  aiIsGloballyActive?: boolean;
  openRouterApiKey?: string;
}) {
  await requireRole(['ADMIN']);

  const updateData: any = {};
  if (formData.aiModel) updateData.aiModel = formData.aiModel;
  if (formData.aiTemperature !== undefined) updateData.aiTemperature = formData.aiTemperature;
  if (formData.aiBufferSeconds !== undefined) updateData.aiBufferSeconds = formData.aiBufferSeconds;
  if (formData.aiSystemPrompt) updateData.aiSystemPrompt = formData.aiSystemPrompt;
  if (formData.aiIsGloballyActive !== undefined) updateData.aiIsGloballyActive = formData.aiIsGloballyActive;

  await prisma.clinicConfig.upsert({
    where: { id: 'clinic_default' },
    create: {
      id: 'clinic_default',
      ...updateData,
    },
    update: updateData,
  });

  // Si se ingresó una nueva API Key de OpenRouter, actualizar el archivo .env y el proceso en memoria
  if (formData.openRouterApiKey && formData.openRouterApiKey.trim().length > 5) {
    const cleanKey = formData.openRouterApiKey.trim();
    process.env.OPENROUTER_API_KEY = cleanKey;

    try {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('OPENROUTER_API_KEY=')) {
          envContent = envContent.replace(
            /OPENROUTER_API_KEY=.*/,
            `OPENROUTER_API_KEY="${cleanKey}"`
          );
        } else {
          envContent += `\nOPENROUTER_API_KEY="${cleanKey}"\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (fsErr) {
      console.error('Error al guardar OPENROUTER_API_KEY en .env:', fsErr);
    }
  }

  revalidatePath('/settings');
  return { success: true };
}

export interface SimulationToolCallResult {
  toolName: string;
  args: Record<string, any>;
  result: any;
}

export interface SimulationResponse {
  reply: string;
  toolsTriggered: SimulationToolCallResult[];
  latencyMs: number;
  error?: string;
}

export async function simulateAiMessageAction(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<SimulationResponse> {
  await requireRole(['ADMIN', 'RECEPTIONIST']);

  const startTime = Date.now();
  const clinicConfig = await prisma.clinicConfig.findFirst();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return {
      reply: '⚠️ Error: No se ha configurado la clave OPENROUTER_API_KEY. Por favor ingrésala en la pestaña de configuración.',
      toolsTriggered: [],
      latencyMs: Date.now() - startTime,
      error: 'API Key no configurada',
    };
  }

  const model = clinicConfig?.aiModel || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  const systemPrompt = clinicConfig?.aiSystemPrompt || CLINICAL_SYSTEM_PROMPT;

  const messagesForModel: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const h of history) {
    messagesForModel.push({ role: h.role, content: h.content });
  }
  messagesForModel.push({ role: 'user', content: message });

  const toolsTriggered: SimulationToolCallResult[] = [];

  try {
    const openai = getOpenRouterClient(apiKey);

    let response = await openai.chat.completions.create({
      model,
      messages: messagesForModel,
      tools: AI_TOOLS,
      tool_choice: 'auto',
      temperature: clinicConfig?.aiTemperature ?? 0.2,
      max_tokens: 1000,
    });

    let choice = response.choices[0];

    // Bucle de Function Calling
    while (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      messagesForModel.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const toolName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        const executionResult = await executeAiTool(toolName, args, {
          patientPhone: '+50370000000',
        });

        toolsTriggered.push({
          toolName,
          args,
          result: executionResult,
        });

        messagesForModel.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(executionResult),
        });
      }

      response = await openai.chat.completions.create({
        model,
        messages: messagesForModel,
        tools: AI_TOOLS,
        tool_choice: 'auto',
        temperature: clinicConfig?.aiTemperature ?? 0.2,
        max_tokens: 1000,
      });

      choice = response.choices[0];
    }

    const reply = choice.message.content || 'Sin respuesta';
    const latencyMs = Date.now() - startTime;

    return {
      reply,
      toolsTriggered,
      latencyMs,
    };
  } catch (err: any) {
    console.error('Error en simulación de IA:', err);
    return {
      reply: `❌ Error al conectar con OpenRouter (${err.message})`,
      toolsTriggered,
      latencyMs: Date.now() - startTime,
      error: err.message,
    };
  }
}
