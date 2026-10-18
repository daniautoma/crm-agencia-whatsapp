import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState as initMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';
import { whatsappEvents, WhatsAppEventTypes } from './events';
import { queueIncomingMessageForAi } from '@/lib/ai/agent';

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

class BaileysService {
  private socket: WASocket | null = null;
  private isInitializing = false;
  private reconnectAttempts = 0;
  private authDir: string;

  constructor() {
    this.authDir = process.env.BAILEYS_AUTH_DIR || path.join(process.cwd(), 'baileys_auth');
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  public async initSocket(force = false): Promise<void> {
    if (this.isInitializing) {
      console.log('📱 [Baileys] Inicialización en curso, esperando...');
      return;
    }

    if (this.socket && !force) {
      if (this.isConnected()) {
        console.log('📱 [Baileys] Socket ya conectado.');
        return;
      }
    }

    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {}
      this.socket = null;
    }

    this.isInitializing = true;
    console.log('📱 [Baileys] Inicializando socket de WhatsApp...');

    try {
      const { state, saveCreds } = await initMultiFileAuthState(this.authDir);

      this.socket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      // Guardar credenciales automáticamente
      this.socket.ev.on('creds.update', saveCreds);

      // Manejo de conexión y QR
      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('📸 [Baileys] Nuevo código QR recibido.');
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            await prisma.clinicConfig.update({
              where: { id: 'clinic_default' },
              data: {
                whatsappSessionStatus: 'SCAN_QR',
                whatsappLastQr: qrDataUrl,
              },
            });
            whatsappEvents.emit(WhatsAppEventTypes.QR_UPDATED, { qrDataUrl });
            whatsappEvents.emit(WhatsAppEventTypes.STATUS_CHANGED, { status: 'SCAN_QR' });
          } catch (qrErr) {
            console.error('Error generando QR data URL:', qrErr);
          }
        }

        if (connection === 'connecting') {
          console.log('🔄 [Baileys] Conectando con servidores de WhatsApp...');
          await prisma.clinicConfig.update({
            where: { id: 'clinic_default' },
            data: { whatsappSessionStatus: 'CONNECTING' },
          });
          whatsappEvents.emit(WhatsAppEventTypes.STATUS_CHANGED, { status: 'CONNECTING' });
        }

        if (connection === 'open') {
          console.log('✅ [Baileys] Conexión abierta y autenticada con éxito.');
          this.reconnectAttempts = 0;
          const userJid = this.socket?.user?.id || '';
          const rawPhone = userJid.split(':')[0] || userJid.split('@')[0];
          const connectedPhone = rawPhone ? `+${rawPhone}` : 'Clínica Bianca';

          await prisma.clinicConfig.update({
            where: { id: 'clinic_default' },
            data: {
              whatsappSessionStatus: 'CONNECTED',
              whatsappConnectedNumber: connectedPhone,
              whatsappLastQr: null,
            },
          });

          whatsappEvents.emit(WhatsAppEventTypes.STATUS_CHANGED, {
            status: 'CONNECTED',
            connectedPhone,
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as unknown as { output?: { statusCode?: number } })?.output?.statusCode;
          console.log(`⚠️ [Baileys] Conexión cerrada. Código de salida: ${statusCode}`);
          console.dir(lastDisconnect?.error, { depth: null });
          this.socket = null;

          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('🔴 [Baileys] Sesión cerrada por el teléfono (Logged out). Limpiando credenciales...');
            this.clearAuthFiles();
            await prisma.clinicConfig.update({
              where: { id: 'clinic_default' },
              data: {
                whatsappSessionStatus: 'DISCONNECTED',
                whatsappConnectedNumber: null,
                whatsappLastQr: null,
              },
            });
            whatsappEvents.emit(WhatsAppEventTypes.STATUS_CHANGED, { status: 'DISCONNECTED' });
          } else if (shouldReconnect) {
            this.reconnectAttempts++;
            // Reintentar solo hasta 5 veces de forma automática
            if (this.reconnectAttempts <= 5) {
              const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
              console.log(`🔄 [Baileys] Reintentando reconexión en ${delay} ms (intento ${this.reconnectAttempts})...`);
              setTimeout(() => {
                this.initSocket();
              }, delay);
            } else {
              console.log('⏸️ [Baileys] Máximo de reintentos alcanzado. En espera de solicitud manual de QR.');
              await prisma.clinicConfig.update({
                where: { id: 'clinic_default' },
                data: { whatsappSessionStatus: 'DISCONNECTED' },
              });
              whatsappEvents.emit(WhatsAppEventTypes.STATUS_CHANGED, { status: 'DISCONNECTED' });
            }
          }
        }
      });

      // Escucha de mensajes entrantes
      this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          // Ignorar mensajes de grupos, estados o emitidos por nosotros mismos
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast' || msg.key.fromMe) {
            continue;
          }

          // Extraer texto
          const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            '';

          if (!text.trim()) continue;

          console.log(`📩 [Baileys] Mensaje recibido de ${remoteJid}: "${text.slice(0, 40)}"`);

          const rawNumber = remoteJid.split('@')[0];
          const phoneNormalized = normalizeElSalvadorPhone(rawNumber);

          try {
            // 1. Alta automática de paciente si no existe
            let patient = await prisma.patient.findUnique({
              where: { phoneNormalized },
            });

            if (!patient) {
              const pushName = msg.pushName || `Paciente WhatsApp (${phoneNormalized})`;
              patient = await prisma.patient.create({
                data: {
                  fullName: pushName,
                  phoneNormalized,
                  tags: 'Nuevo,WhatsApp',
                  generalNotes: 'Contacto creado automáticamente al recibir mensaje por WhatsApp.',
                  reminderPreference: 'WHATSAPP',
                },
              });
              console.log(`👤 [Baileys] Nuevo paciente auto-creado: ${patient.fullName}`);
            }

            // 2. Upsert de la Conversación
            const conversation = await prisma.conversation.upsert({
              where: { whatsappJid: remoteJid },
              create: {
                patientId: patient.id,
                whatsappJid: remoteJid,
                status: 'OPEN',
                isAiActive: true,
                lastMessageAt: new Date(),
              },
              update: {
                lastMessageAt: new Date(),
              },
            });

            // 3. Guardar Mensaje en Base de Datos
            const savedMessage = await prisma.message.create({
              data: {
                conversationId: conversation.id,
                senderType: 'PATIENT',
                text: text.trim(),
                status: 'DELIVERED',
                baileysMsgId: msg.key.id,
              },
            });

            // 4. Emitir evento en tiempo real para SSE
            whatsappEvents.emit(WhatsAppEventTypes.NEW_MESSAGE, {
              conversationId: conversation.id,
              message: savedMessage,
              patient: {
                id: patient.id,
                fullName: patient.fullName,
                phoneNormalized: patient.phoneNormalized,
              },
            });

            whatsappEvents.emit(WhatsAppEventTypes.CONVERSATION_UPDATED, {
              conversationId: conversation.id,
              lastMessageText: text.trim(),
              lastMessageAt: new Date(),
            });

            // 5. Encolar para el agente autónomo de IA si la conversación tiene IA activa
            if (conversation.isAiActive) {
              queueIncomingMessageForAi(conversation.id, phoneNormalized, text.trim()).catch((aiErr) => {
                console.error('[Baileys -> AI] Error al encolar mensaje:', aiErr);
              });
            }
          } catch (dbErr) {
            console.error('Error al persistir mensaje entrante de WhatsApp:', dbErr);
          }
        }
      });
    } catch (err) {
      console.error('Error al inicializar Baileys socket:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  public async sendMessage(remoteJid: string, text: string): Promise<boolean> {
    if (!this.socket) {
      console.warn('⚠️ [Baileys] No se puede enviar mensaje: socket desconectado.');
      return false;
    }

    try {
      // Asegurar formato JID
      const formattedJid = remoteJid.includes('@') ? remoteJid : `${remoteJid.replace('+', '')}@s.whatsapp.net`;
      await this.socket.sendMessage(formattedJid, { text });
      return true;
    } catch (err) {
      console.error(`Error enviando mensaje WhatsApp a ${remoteJid}:`, err);
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch {
        // Ignorar si ya está desconectado
      }
      this.socket = null;
    }

    this.clearAuthFiles();
    await prisma.clinicConfig.update({
      where: { id: 'clinic_default' },
      data: {
        whatsappSessionStatus: 'DISCONNECTED',
        whatsappConnectedNumber: null,
        whatsappLastQr: null,
      },
    });

    whatsappEvents.emit(WhatsAppEventTypes.STATUS_CHANGED, { status: 'DISCONNECTED' });
  }

  private clearAuthFiles(): void {
    if (fs.existsSync(this.authDir)) {
      try {
        const files = fs.readdirSync(this.authDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.authDir, file));
        }
      } catch (e) {
        console.error('Error limpiando archivos de auth Baileys:', e);
      }
    }
  }

  public getAuthDir(): string {
    return this.authDir;
  }

  public isConnected(): boolean {
    return !!this.socket && !!this.socket.user;
  }
}

// Singleton global
const globalForBaileys = globalThis as unknown as {
  baileysService: BaileysService | undefined;
};

export const baileysService = globalForBaileys.baileysService ?? new BaileysService();

if (process.env.NODE_ENV !== 'production') {
  globalForBaileys.baileysService = baileysService;
}

// Si ya existen credenciales guardadas, auto-conectar el socket
if (fs.existsSync(path.join(baileysService.getAuthDir(), 'creds.json')) && !baileysService.isConnected()) {
  baileysService.initSocket().catch((e) => {
    console.error('Error auto-iniciando Baileys:', e);
  });
}

export default baileysService;
