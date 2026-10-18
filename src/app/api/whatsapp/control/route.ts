import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { baileysService } from '@/lib/whatsapp/baileys';
import { requireRole } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = await prisma.clinicConfig.findUnique({
    where: { id: 'clinic_default' },
    select: {
      whatsappSessionStatus: true,
      whatsappConnectedNumber: true,
      whatsappLastQr: true,
    },
  });

  return NextResponse.json({
    status: config?.whatsappSessionStatus || 'DISCONNECTED',
    connectedNumber: config?.whatsappConnectedNumber || null,
    lastQr: config?.whatsappLastQr || null,
    isSocketAlive: baileysService.isConnected(),
  });
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['ADMIN']);
    const body = await request.json();
    const action = body.action as 'start' | 'disconnect' | 'restart';

    if (action === 'start') {
      await baileysService.initSocket(true);
      return NextResponse.json({ success: true, message: 'Iniciando conexión de WhatsApp y generando QR...' });
    }

    if (action === 'disconnect') {
      await baileysService.disconnect();
      return NextResponse.json({ success: true, message: 'Sesión de WhatsApp desconectada.' });
    }

    if (action === 'restart') {
      await baileysService.disconnect();
      setTimeout(async () => {
        await baileysService.initSocket(true);
      }, 1000);
      return NextResponse.json({ success: true, message: 'Reiniciando sesión de WhatsApp...' });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al controlar WhatsApp';
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
