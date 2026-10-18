'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import { formatSVPhone } from '@/lib/utils';
import { createPatientAction, updatePatientAction } from '@/app/actions/patients';
import Link from 'next/link';

interface PatientItem {
  id: string;
  fullName: string;
  phoneNormalized: string;
  email: string | null;
  birthDate: Date | null;
  tags: string;
  generalNotes: string | null;
  reminderPreference: string;
  createdAt: Date;
  _count: {
    appointments: number;
    conversations: number;
  };
}

interface PatientsManagerProps {
  initialPatients: PatientItem[];
}

export function PatientsManager({ initialPatients }: PatientsManagerProps) {
  const [patients, setPatients] = useState<PatientItem[]>(initialPatients);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientItem | null>(null);
  const [selectedPatientForDrawer, setSelectedPatientForDrawer] = useState<PatientItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [tags, setTags] = useState('Nuevo');
  const [generalNotes, setGeneralNotes] = useState('');
  const [reminderPreference, setReminderPreference] = useState<'WHATSAPP' | 'EMAIL' | 'NONE'>('WHATSAPP');

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.phoneNormalized.includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      p.tags.toLowerCase().includes(q)
    );
  });

  const openCreateModal = () => {
    setEditingPatient(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setBirthDate('');
    setTags('Nuevo');
    setGeneralNotes('');
    setReminderPreference('WHATSAPP');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: PatientItem) => {
    setEditingPatient(p);
    setFullName(p.fullName);
    setPhone(p.phoneNormalized.replace('+503', ''));
    setEmail(p.email || '');
    setBirthDate(p.birthDate ? new Date(p.birthDate).toISOString().split('T')[0] : '');
    setTags(p.tags);
    setGeneralNotes(p.generalNotes || '');
    setReminderPreference((p.reminderPreference as 'WHATSAPP' | 'EMAIL' | 'NONE') || 'WHATSAPP');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('phone', phone);
    formData.append('email', email);
    formData.append('birthDate', birthDate);
    formData.append('tags', tags);
    formData.append('generalNotes', generalNotes);
    formData.append('reminderPreference', reminderPreference);

    if (editingPatient) {
      const res = await updatePatientAction(editingPatient.id, formData);
      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }
      if (res.patient) {
        setPatients((prev) =>
          prev.map((p) =>
            p.id === editingPatient.id
              ? {
                  ...(res.patient as unknown as PatientItem),
                  _count: p._count,
                }
              : p
          )
        );
      }
    } else {
      const res = await createPatientAction(formData);
      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }
      if (res.patient) {
        const newPatientItem: PatientItem = {
          ...(res.patient as unknown as PatientItem),
          _count: { appointments: 0, conversations: 1 },
        };
        setPatients((prev) => [newPatientItem, ...prev]);
      }
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Botón superior y buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono (+503) o etiqueta..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 shadow-xs"
          />
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-xs flex items-center gap-1.5 self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo Paciente
        </button>
      </div>

      {/* Tabla de Pacientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Mostrando <span className="font-bold text-slate-900">{filteredPatients.length}</span> de{' '}
            <span className="font-bold text-slate-900">{patients.length}</span> pacientes
          </span>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron pacientes</p>
            <p className="text-xs text-slate-400 mt-1">Pruebe ajustando el término de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Teléfono WhatsApp</th>
                  <th className="py-3 px-4">Etiquetas</th>
                  <th className="py-3 px-4">Citas</th>
                  <th className="py-3 px-4">Preferencia Notif.</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{p.fullName}</div>
                      <div className="text-[11px] text-slate-400">{p.email || 'Sin correo electrónico'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {formatSVPhone(p.phoneNormalized)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {p.tags.split(',').map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {p._count.appointments} cita(s)
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {p.reminderPreference}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedPatientForDrawer(p)}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Ver Ficha
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Paciente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingPatient ? 'Editar Ficha del Paciente' : 'Alta de Nuevo Paciente'}
                </h3>
                <p className="text-xs text-slate-500">
                  Normalización con código de país de El Salvador (+503)
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ej. Juan Antonio Ramos"
                  className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono Móvil (WhatsApp) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      +503
                    </span>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="7123-4567"
                      className="w-full pl-13 pr-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="paciente@correo.com"
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Etiquetas (separadas por coma)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Nuevo, Ortodoncia, VIP"
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferencia de Recordatorio
                  </label>
                  <select
                    value={reminderPreference}
                    onChange={(e) => setReminderPreference(e.target.value as 'WHATSAPP' | 'EMAIL' | 'NONE')}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                  >
                    <option value="WHATSAPP">WhatsApp (Automatizado)</option>
                    <option value="EMAIL">Correo Electrónico</option>
                    <option value="NONE">Sin Recordatorio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas Administrativas
                </label>
                <textarea
                  rows={3}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Alergias, preferencias de horario o notas de recepción..."
                  className="w-full p-3 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-xs disabled:opacity-60"
                >
                  {isSubmitting ? 'Guardando...' : editingPatient ? 'Actualizar Ficha' : 'Registrar Paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha Completa del Paciente */}
      {selectedPatientForDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900">Ficha del Paciente</h3>
              <button
                onClick={() => setSelectedPatientForDrawer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center pb-4 border-b border-slate-100">
                <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 font-bold text-lg flex items-center justify-center mx-auto mb-2">
                  {selectedPatientForDrawer.fullName.charAt(0)}
                </div>
                <h4 className="font-bold text-base text-slate-900">{selectedPatientForDrawer.fullName}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatSVPhone(selectedPatientForDrawer.phoneNormalized)}
                </p>
                {selectedPatientForDrawer.email && (
                  <p className="text-xs text-slate-400">{selectedPatientForDrawer.email}</p>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">Etiquetas</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedPatientForDrawer.tags.split(',').map((t) => (
                      <span key={t} className="badge badge-brand">
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Notas Administrativas
                  </span>
                  <p className="text-slate-700 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-[11px]">
                    {selectedPatientForDrawer.generalNotes || 'Sin notas registradas aún.'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    Historial de Actividad
                  </span>
                  <p className="text-slate-600 mt-0.5 text-[11px]">
                    • Citas registradas: <strong>{selectedPatientForDrawer._count.appointments}</strong>
                    <br />• Canal principal: WhatsApp ({selectedPatientForDrawer.reminderPreference})
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-2">
                <Link
                  href={`/calendar?action=new&patientId=${selectedPatientForDrawer.id}`}
                  className="flex-1 py-2 text-center rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Agendar Cita Directa
                </Link>
                <Link
                  href="/chat"
                  className="px-3.5 py-2 text-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Abrir WhatsApp
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
