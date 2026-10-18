import { EventEmitter } from 'events';

// EventEmitter global para sincronización de eventos de WhatsApp y SSE
const globalForEvents = globalThis as unknown as {
  whatsappEvents: EventEmitter | undefined;
};

export const whatsappEvents =
  globalForEvents.whatsappEvents ?? new EventEmitter();

// Incrementar límite de listeners para múltiples clientes SSE conectados
whatsappEvents.setMaxListeners(100);

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.whatsappEvents = whatsappEvents;
}

export const WhatsAppEventTypes = {
  QR_UPDATED: 'qr_updated',
  STATUS_CHANGED: 'status_changed',
  NEW_MESSAGE: 'new_message',
  CONVERSATION_UPDATED: 'conversation_updated',
  AI_PAUSED: 'ai_paused',
} as const;
