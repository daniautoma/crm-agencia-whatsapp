'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertCircle,
  X,
  Bot,
} from 'lucide-react';
import { formatUSD, formatSVPhone } from '@/lib/utils';
import { createAppointmentAction, updateAppointmentStatusAction } from '@/app/actions/appointments';

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
}

interface PatientItem {
  id: string;
  fullName: string;
  phoneNormalized: string;
}

interface DentistItem {
  id: string;
  name: string;
}

interface AppointmentItem {
  id: string;
  patientId: string;
  professionalId: string;
  serviceId: string;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  origin: string;
  adminNotes: string | null;
  patient: {
    fullName: string;
    phoneNormalized: string;
  };
  service: {
    name: string;
    durationMinutes: number;
    price: number;
  };
  professional: {
    name: string;
  };
}

interface CalendarManagerProps {
  initialAppointments: AppointmentItem[];
  services: ServiceItem[];
  dentists: DentistItem[];
  patients: PatientItem[];
  userRole: string;
  currentUserId: string;
}

export function CalendarManager({
  initialAppointments,
  services,
  dentists,
  patients,
  userRole: _userRole,
}: CalendarManagerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [appointments, setAppointments] = useState<AppointmentItem[]>(initialAppointments);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'agenda'>('week');
  const [selectedDentistId, setSelectedDentistId] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Modal de Nueva Cita
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '');
  const [selectedProfId, setSelectedProfId] = useState(dentists[0]?.id || '');
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointmentTime, setAppointmentTime] = useState('09:00');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collisionError, setCollisionError] = useState<string | null>(null);

  // Modal de Detalle / Cambio de Estado de Cita
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);

  // Detectar ?action=new en URL
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      const pId = searchParams.get('patientId');
      if (pId) setSelectedPatientId(pId);
      setIsNewModalOpen(true);
    }
  }, [searchParams]);

  // Cálculo del tiempo de fin estimado
  const currentService = services.find((s) => s.id === selectedServiceId);
  const duration = currentService?.durationMinutes || 30;

  const calculateEndTime = (timeStr: string, durMin: number) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = h * 60 + m + durMin;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  const endTimeStr = calculateEndTime(appointmentTime, duration);

  const handleOpenNewModal = (dateStr?: string, timeStr?: string) => {
    if (dateStr) setAppointmentDate(dateStr);
    if (timeStr) setAppointmentTime(timeStr);
    setCollisionError(null);
    setIsNewModalOpen(true);
  };

  const handleCloseNewModal = () => {
    setIsNewModalOpen(false);
    setCollisionError(null);
    if (searchParams.get('action') === 'new') {
      router.replace('/calendar');
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCollisionError(null);

    // Armar string ISO fecha + hora en zona America/El_Salvador
    const startISO = `${appointmentDate}T${appointmentTime}:00.000Z`;

    const formData = new FormData();
    formData.append('patientId', selectedPatientId);
    formData.append('professionalId', selectedProfId);
    formData.append('serviceId', selectedServiceId);
    formData.append('startTime', startISO);
    formData.append('adminNotes', adminNotes);
    formData.append('origin', 'RECEPTION');

    const res = await createAppointmentAction(formData);

    if (res.error) {
      setCollisionError(res.error);
      setIsSubmitting(false);
      return;
    }

    if (res.appointment) {
      setAppointments((prev) => [...prev, res.appointment as unknown as AppointmentItem]);
      setIsSubmitting(false);
      handleCloseNewModal();
    }
  };

  const handleStatusChange = async (newStatus: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW') => {
    if (!selectedAppointment) return;
    setIsStatusSubmitting(true);

    const res = await updateAppointmentStatusAction(selectedAppointment.id, newStatus);
    if (res.success && res.appointment) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === selectedAppointment.id ? { ...a, status: newStatus } : a))
      );
      setSelectedAppointment(null);
    }
    setIsStatusSubmitting(false);
  };

  // Filtrado por profesional
  const filteredAppointments = selectedDentistId === 'ALL'
    ? appointments
    : appointments.filter((a) => a.professionalId === selectedDentistId);

  // Formato de hora en El Salvador
  const formatTimeSV = (dateVal: Date | string) => {
    return new Intl.DateTimeFormat('es-SV', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/El_Salvador',
    }).format(new Date(dateVal));
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
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

  // Días de la semana actual
  const getDaysOfWeek = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 6; i++) { // Lunes a Sábado
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const currentWeekDays = getDaysOfWeek(currentDate);

  const hours = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ];

  return (
    <div className="space-y-4">
      {/* Controles de Navegación y Vistas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const prev = new Date(currentDate);
                prev.setDate(prev.getDate() - 7);
                setCurrentDate(prev);
              }}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => {
                const next = new Date(currentDate);
                next.setDate(next.getDate() + 7);
                setCurrentDate(next);
              }}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            {new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric' }).format(currentDate).toUpperCase()}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de Profesional */}
          <div className="relative">
            <select
              value={selectedDentistId}
              onChange={(e) => setSelectedDentistId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 font-medium"
            >
              <option value="ALL">Todos los Odontólogos</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vistas */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'agenda' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lista Agenda
            </button>
          </div>

          {/* Botón Agendar Cita */}
          <button
            onClick={() => handleOpenNewModal()}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Cita
          </button>
        </div>
      </div>

      {/* Vista de Semana */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {/* Header de Días */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700">
            <div className="p-3 text-center border-r border-slate-200 text-slate-400">Hora</div>
            {currentWeekDays.map((d) => {
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <div
                  key={d.toISOString()}
                  className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${
                    isToday ? 'bg-indigo-50/60 text-brand-700' : ''
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">
                    {new Intl.DateTimeFormat('es-SV', { weekday: 'short' }).format(d)}
                  </div>
                  <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-brand-600' : 'text-slate-900'}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid de Horas y Turnos */}
          <div className="divide-y divide-slate-100 max-h-[650px] overflow-y-auto">
            {hours.map((h) => (
              <div key={h} className="grid grid-cols-7 min-h-[52px]">
                <div className="p-2 text-center text-[11px] font-semibold text-slate-400 border-r border-slate-100 bg-slate-50/30">
                  {h}
                </div>

                {currentWeekDays.map((d) => {
                  const dateStr = d.toISOString().split('T')[0];
                  const matched = filteredAppointments.filter((a) => {
                    const aDate = new Date(a.startTime).toISOString().split('T')[0];
                    return aDate === dateStr && a.status !== 'CANCELLED';
                  });

                  return (
                    <div
                      key={dateStr + h}
                      onClick={() => handleOpenNewModal(dateStr, h)}
                      className="p-1 border-r border-slate-100 last:border-r-0 hover:bg-indigo-50/20 transition-colors cursor-pointer relative min-h-[50px]"
                    >
                      {/* Renderizar citas que caen en este día y hora */}
                      {matched
                        .filter((a) => {
                          const aStart = new Date(a.startTime);
                          const appH = aStart.getHours().toString().padStart(2, '0');
                          const appM = aStart.getMinutes().toString().padStart(2, '0');
                          return `${appH}:${appM}` === h;
                        })
                        .map((app) => (
                          <div
                            key={app.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(app);
                            }}
                            className={`p-2 rounded-xl text-left border shadow-xs transition-all ${
                              app.origin === 'WHATSAPP_AI'
                                ? 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
                                : 'bg-brand-50 border-brand-200 text-brand-900 hover:bg-brand-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-bold text-[11px] truncate">{app.patient.fullName}</span>
                              {app.origin === 'WHATSAPP_AI' && (
                                <span title="Agendada por WhatsApp IA">
                                  <Bot className="w-3 h-3 text-purple-600 shrink-0" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-600 truncate">{app.service.name}</div>
                            <div className="text-[9px] text-slate-400 mt-1 flex items-center justify-between">
                              <span>{formatTimeSV(app.startTime)}</span>
                              <span>{renderStatusBadge(app.status)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista de Lista Agenda */}
      {viewMode === 'agenda' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Citas Registradas ({filteredAppointments.length})</span>
            <span className="text-slate-400 font-normal">Validación estricta anti-colisión</span>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No hay citas programadas para el filtro seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Fecha & Hora</th>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Tratamiento</th>
                    <th className="py-3 px-4">Odontólogo/a</th>
                    <th className="py-3 px-4">Origen</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {new Intl.DateTimeFormat('es-SV', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'America/El_Salvador',
                        }).format(new Date(app.startTime))}{' '}
                        • {formatTimeSV(app.startTime)}
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
                        {app.origin === 'WHATSAPP_AI' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            <Bot className="w-3 h-3" /> WhatsApp IA
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            Recepción
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">{renderStatusBadge(app.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedAppointment(app)}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Nueva Cita (Anti-Colisión) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Agendar Cita Odontológica</h3>
                <p className="text-xs text-slate-500">
                  Verificación de solapamiento transaccional en tiempo real
                </p>
              </div>
              <button
                onClick={handleCloseNewModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Banner de Conflicto de Horario / Colisión */}
            {collisionError && (
              <div className="mx-5 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <strong className="font-bold block">Conflicto de Horario Detectado:</strong>
                  <span>{collisionError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="p-5 space-y-4">
              {/* Paciente */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paciente *
                </label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 font-medium"
                >
                  <option value="">Seleccione un paciente registrado...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({formatSVPhone(p.phoneNormalized)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tratamiento / Servicio */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tratamiento / Servicio Odontológico *
                </label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 font-medium"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.durationMinutes} min ({formatUSD(s.price)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Odontólogo Asignado */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Odontólogo/a Asignado/a *
                </label>
                <select
                  required
                  value={selectedProfId}
                  onChange={(e) => setSelectedProfId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 font-medium"
                >
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fecha de la Cita *
                  </label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hora de Inicio *
                  </label>
                  <input
                    type="time"
                    required
                    step="900"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 font-mono font-medium"
                  />
                </div>
              </div>

              {/* Resumen del intervalo de tiempo calculado */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Intervalo reservado: <strong>{appointmentTime}</strong> a <strong>{endTimeStr}</strong>
                </span>
                <span className="badge badge-brand">{duration} minutos</span>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas Administrativas
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Detalles sobre el motivo de consulta o requerimientos especiales..."
                  className="w-full p-2.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseNewModal}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-xs disabled:opacity-60"
                >
                  {isSubmitting ? 'Verificando y Reservando...' : 'Confirmar Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Gestionar Estado de Cita Existente */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Detalles de la Cita</h3>
                <p className="text-xs text-slate-500">
                  {new Intl.DateTimeFormat('es-SV', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'America/El_Salvador',
                  }).format(new Date(selectedAppointment.startTime))}
                </p>
              </div>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Paciente:</span>
                  <span className="font-bold text-slate-900">{selectedAppointment.patient.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tratamiento:</span>
                  <span className="font-semibold text-slate-800">{selectedAppointment.service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Horario:</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    {formatTimeSV(selectedAppointment.startTime)} - {formatTimeSV(selectedAppointment.endTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Odontólogo:</span>
                  <span className="text-slate-800">{selectedAppointment.professional.name}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-400">Estado actual:</span>
                  {renderStatusBadge(selectedAppointment.status)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Actualizar Estado Operativo:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    disabled={isStatusSubmitting}
                    onClick={() => handleStatusChange('CONFIRMED')}
                    className="p-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    Confirmada
                  </button>

                  <button
                    disabled={isStatusSubmitting}
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    className="p-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 font-semibold hover:bg-indigo-100 transition-colors"
                  >
                    En Atención
                  </button>

                  <button
                    disabled={isStatusSubmitting}
                    onClick={() => handleStatusChange('COMPLETED')}
                    className="p-2 rounded-xl border border-slate-300 bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Atendida (Finalizada)
                  </button>

                  <button
                    disabled={isStatusSubmitting}
                    onClick={() => handleStatusChange('CANCELLED')}
                    className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 font-semibold hover:bg-rose-100 transition-colors"
                  >
                    Cancelar Cita
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
