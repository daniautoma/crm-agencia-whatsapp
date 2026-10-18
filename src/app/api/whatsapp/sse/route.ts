import { NextRequest } from 'next/server';
import { whatsappEvents, WhatsAppEventTypes } from '@/lib/whatsapp/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Función para enviar mensaje formateado SSE
      const sendEvent = (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // El stream puede haberse cerrado
        }
      };

      // Handlers de eventos
      const onQrUpdated = (data: unknown) => sendEvent('qr', data);
      const onStatusChanged = (data: unknown) => sendEvent('status', data);
      const onNewMessage = (data: unknown) => sendEvent('message', data);
      const onConversationUpdated = (data: unknown) => sendEvent('conversation', data);

      whatsappEvents.on(WhatsAppEventTypes.QR_UPDATED, onQrUpdated);
      whatsappEvents.on(WhatsAppEventTypes.STATUS_CHANGED, onStatusChanged);
      whatsappEvents.on(WhatsAppEventTypes.NEW_MESSAGE, onNewMessage);
      whatsappEvents.on(WhatsAppEventTypes.CONVERSATION_UPDATED, onConversationUpdated);

      // Keep-alive heartbeat cada 20 segundos
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 20000);

      // Limpieza al cerrar la conexión
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        whatsappEvents.off(WhatsAppEventTypes.QR_UPDATED, onQrUpdated);
        whatsappEvents.off(WhatsAppEventTypes.STATUS_CHANGED, onStatusChanged);
        whatsappEvents.off(WhatsAppEventTypes.NEW_MESSAGE, onNewMessage);
        whatsappEvents.off(WhatsAppEventTypes.CONVERSATION_UPDATED, onConversationUpdated);
        try {
          controller.close();
        } catch {
          // Ya cerrado
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
