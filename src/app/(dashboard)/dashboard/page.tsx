import React from 'react';
import { requireAuth } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  Calendar,
  Users,
  MessageSquare,
  Sparkles,
  Bot,
  Radio,
  ChevronRight,
} from 'lucide-react';
import { formatUSD, formatSVPhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth();

  // Rango del día de hoy en la zona horaria de El Salvador (aprox UTC-6)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // Filtro si es odontólogo (solo ve sus citas)
  const appointmentWhere: Record<string, unknown> = {
    startTime: {
      gte: startOfDay,
      lte: endOfDay,
    },
  };

  if (session.role === 'DENTIST') {
    appointmentWhere.professionalId = session.userId;
  }

  // 1. Consultas a la Base de Datos
  const [
    todayAppointments,
    totalPatientsCount,
    pendingChatsCount,
    aiAppointmentsCount,
    clinicConfig,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: appointmentWhere,
      include: {
        patient: true,
        service: true,
        professional: {
          select: { name: true },
        },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.patient.count(),
    prisma.conversation.count({
      where: { status: 'PENDING_HUMAN' },
    }),
    prisma.appointment.count({
      where: { origin: 'WHATSAPP_AI' },
    }),
    prisma.clinicConfig.findUnique({
      where: { id: 'clinic_default' },
    }),
  ]);

  const confirmedCount = todayAppointments.filter((a) => a.status === 'CONFIRMED').length;
  const inProgressCount = todayAppointments.filter((a) => a.status === 'IN_PROGRESS').length;
  const completedCount = todayAppointments.filter((a) => a.status === 'COMPLETED').length;

  const whatsappConnected = clinicConfig?.whatsappSessionStatus === 'CONNECTED';
  const aiActive = clinicConfig?.aiIsGloballyActive ?? true;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="badge badge-success">Confirmada</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-brand">En atención</span>;
      case 'COMPLETED':
        return <span className="badge badge-neutral">Atendida</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger">Cancelada</span>;
      default:
        return <span className="badge badge-warning">Solicitada</span>;
    }
  };

  const originBadge = (origin: string) => {
    if (origin === 'WHATSAPP_AI') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
          <Bot className="w-3 h-3" />
          WhatsApp IA
        </span>
      );
    }
    return (
      <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
        Recepción
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Bienvenida y Resumen Operativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Panel Operativo
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bienvenido/a, <span className="font-semibold text-slate-700">{session.name}</span>. Resumen de la jornada en daniautoma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/calendar"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            Ver Calendario
          </Link>
          <Link
            href="/chat"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Bandeja WhatsApp
          </Link>
        </div>
      </div>

      {/* Tarjetas de Métricas Principales (Estilo Untitled UI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Métrica 1: Citas de Hoy */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Citas de la Jornada</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{todayAppointments.length}</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              {confirmedCount} confirmadas
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {completedCount} atendidas • {inProgressCount} en sillón
          </p>
        </div>

        {/* Métrica 2: Pacientes Totales */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Directorio de Pacientes</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalPatientsCount}</span>
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
              Activos
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Base normalizada (+503 El Salvador)
          </p>
        </div>

        {/* Métrica 3: Chats Requieren Atención Humana */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Chats Por Atender</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pendingChatsCount}</span>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
              Humano requerido
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Pausados o derivados por la IA
          </p>
        </div>

        {/* Métrica 4: Citas Agendadas por la IA */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Citas Originadas por IA</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{aiAppointmentsCount}</span>
            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full">
              Autónomas
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Vía OpenRouter + Function Calling
          </p>
        </div>
      </div>

      {/* Tarjetas de Estado Operativo de la Infraestructura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estado WhatsApp */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                whatsappConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">Sesión de WhatsApp</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    whatsappConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {whatsappConnected ? 'CONECTADO' : 'DESCONECTADO'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {whatsappConnected
                  ? `Vinculado al número: ${clinicConfig?.whatsappConnectedNumber || 'daniautoma'}`
                  : 'Requiere vincular código QR desde Configuración'}
              </p>
            </div>
          </div>

          {session.role === 'ADMIN' && (
            <Link
              href="/settings"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Gestionar <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Estado IA */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                aiActive ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">Asistente IA (OpenRouter)</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    aiActive ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {aiActive ? 'ACTIVO' : 'PAUSADO'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Modelo: {clinicConfig?.aiModel || 'google/gemini-2.5-flash'} • Buffer: 8s
              </p>
            </div>
          </div>

          {session.role === 'ADMIN' && (
            <Link
              href="/settings"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              Ajustar IA <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Tabla de Citas del Día */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Agenda de Citas de Hoy</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Citas programadas para la fecha con validación anti-solapamiento
            </p>
          </div>
          <Link
            href="/calendar"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 self-start sm:self-auto"
          >
            Abrir Calendario Completo <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No hay citas registradas para hoy</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Las citas agendadas por recepción o mediante el asistente de WhatsApp aparecerán reflejadas aquí.
            </p>
            <div className="mt-4">
              <Link
                href="/calendar?action=new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
              >
                Programar primera cita
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Tratamiento</th>
                  <th className="py-3 px-4">Odontólogo/a</th>
                  <th className="py-3 px-4">Origen</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayAppointments.map((app) => {
                  const startTimeStr = new Intl.DateTimeFormat('es-SV', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/El_Salvador',
                  }).format(app.startTime);

                  return (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {startTimeStr}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{app.patient.fullName}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatSVPhone(app.patient.phoneNormalized)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{app.service.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatUSD(app.service.price)} • {app.service.durationMinutes} min
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {app.professional.name}
                      </td>
                      <td className="py-3 px-4">
                        {originBadge(app.origin)}
                      </td>
                      <td className="py-3 px-4">
                        {statusBadge(app.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
