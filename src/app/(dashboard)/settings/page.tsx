import React from 'react';
import { requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { Users } from 'lucide-react';
import { WhatsAppSettings } from '@/components/settings/WhatsAppSettings';
import { AiSettingsPlayground } from '@/components/settings/AiSettingsPlayground';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireRole(['ADMIN']);

  const [clinicConfig, users] = await Promise.all([
    prisma.clinicConfig.findUnique({
      where: { id: 'clinic_default' },
    }),
    prisma.user.findMany({
      orderBy: { role: 'asc' },
    }),
  ]);

  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Centro de Control y Configuración
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Gestión exclusiva de Administrador: Vinculación de WhatsApp, Agente Autónomo de IA (Esteban) con Simulador y Equipo.
        </p>
      </div>

      {/* 1. Módulo de WhatsApp en Vivo (Baileys) */}
      <WhatsAppSettings
        initialStatus={clinicConfig?.whatsappSessionStatus || 'DISCONNECTED'}
        initialPhone={clinicConfig?.whatsappConnectedNumber || null}
        initialQr={clinicConfig?.whatsappLastQr || null}
      />

      {/* 2. Módulo de IA: Parámetros del Agente + Playground Interactivo */}
      <AiSettingsPlayground
        initialConfig={{
          aiModel: clinicConfig?.aiModel || 'google/gemini-2.5-flash',
          aiTemperature: clinicConfig?.aiTemperature ?? 0.2,
          aiBufferSeconds: clinicConfig?.aiBufferSeconds ?? 8,
          aiSystemPrompt: clinicConfig?.aiSystemPrompt || '',
          aiIsGloballyActive: clinicConfig?.aiIsGloballyActive ?? true,
        }}
        hasApiKey={hasApiKey}
      />

      {/* 3. Panel: Equipo de la Agencia (Usuarios y Roles RBAC) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Personal y Roles (RBAC)</h3>
              <p className="text-[11px] text-slate-500">Usuarios con credenciales de acceso al CRM</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {users.map((u) => (
            <div key={u.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                  {u.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-xs text-slate-900">{u.name}</div>
                  <div className="text-[11px] text-slate-400">{u.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    u.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-700'
                      : u.role === 'RECEPTIONIST'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {u.role}
                </span>
                <span className="text-[11px] font-medium text-emerald-600">Activo</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
