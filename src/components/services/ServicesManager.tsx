'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Clock, X, AlertCircle } from 'lucide-react';
import { formatUSD } from '@/lib/utils';
import { createServiceAction, updateServiceAction, toggleServiceStatusAction } from '@/app/actions/services';

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  isPriceVariable: boolean;
  isActive: boolean;
}

interface ServicesManagerProps {
  initialServices: ServiceItem[];
  canEdit: boolean;
}

export function ServicesManager({ initialServices, canEdit }: ServicesManagerProps) {
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState(30);
  const [isPriceVariable, setIsPriceVariable] = useState(false);

  const categories = ['Todos', ...Array.from(new Set(services.map((s) => s.category)))];

  const filteredServices = selectedCategory === 'Todos'
    ? services
    : services.filter((s) => s.category === selectedCategory);

  const openCreateModal = () => {
    setEditingService(null);
    setName('');
    setCategory('General');
    setDescription('');
    setDurationMinutes(30);
    setPrice(35);
    setIsPriceVariable(false);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (service: ServiceItem) => {
    setEditingService(service);
    setName(service.name);
    setCategory(service.category);
    setDescription(service.description || '');
    setDurationMinutes(service.durationMinutes);
    setPrice(service.price);
    setIsPriceVariable(service.isPriceVariable);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('durationMinutes', durationMinutes.toString());
    formData.append('price', price.toString());
    formData.append('isPriceVariable', isPriceVariable ? 'true' : 'false');
    formData.append('isActive', 'true');

    if (editingService) {
      const res = await updateServiceAction(editingService.id, formData);
      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }
      setServices((prev) =>
        prev.map((s) => (s.id === editingService.id ? (res.service as ServiceItem) : s))
      );
    } else {
      const res = await createServiceAction(formData);
      if (res.error) {
        setErrorMsg(res.error);
        setIsSubmitting(false);
        return;
      }
      if (res.service) {
        setServices((prev) => [...prev, res.service as ServiceItem]);
      }
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const handleToggleActive = async (id: string) => {
    if (!canEdit) return;
    const res = await toggleServiceStatusAction(id);
    if (res.success && res.isActive !== undefined) {
      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive: res.isActive as boolean } : s))
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra superior con filtros por categoría y botón de creación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Categorías Pills */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {canEdit && (
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 shadow-xs flex items-center gap-1.5 self-start sm:self-auto transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Tratamiento
          </button>
        )}
      </div>

      {/* Grid de Servicios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className={`p-5 rounded-2xl bg-white border shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between ${
              service.isActive ? 'border-slate-200' : 'border-slate-200/60 opacity-60 bg-slate-50/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
                  {service.category}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(service.id)}
                    title={service.isActive ? 'Desactivar servicio' : 'Activar servicio'}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      service.isActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {service.isActive ? 'Activo' : 'Inactivo'}
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => openEditModal(service)}
                      className="p-1 rounded-md text-slate-400 hover:text-brand-600 hover:bg-slate-50 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-bold text-sm text-slate-900">{service.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {service.description || 'Sin descripción orientativa.'}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{service.durationMinutes} min</span>
              </div>

              <div className="text-right">
                <div className="text-base font-bold text-slate-900">
                  {service.isPriceVariable ? `Desde ${formatUSD(service.price)}` : formatUSD(service.price)}
                </div>
                {service.isPriceVariable && (
                  <span className="text-[10px] text-amber-600 font-medium block">
                    Sujeto a valoración previa
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Crear / Editar Tratamiento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingService ? 'Editar Tratamiento' : 'Registrar Nuevo Tratamiento'}
                </h3>
                <p className="text-xs text-slate-500">
                  Parámetros para la agenda odontológica y conocimiento de la IA
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
                  Nombre del Tratamiento *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Limpieza Dental Ultrasónica"
                  className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="ej. Prevención, Ortodoncia, Estética"
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duración Estimada (minutos) *
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos (1 hora)</option>
                    <option value={90}>90 minutos (1.5 horas)</option>
                    <option value={120}>120 minutos (2 horas)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Precio Base (USD $) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={isPriceVariable}
                      onChange={(e) => setIsPriceVariable(e.target.checked)}
                      className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                    />
                    <span className="font-medium">Precio Sujeto a Valoración</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción Orientativa (para la IA y Pacientes)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalla qué incluye el procedimiento para que la IA responda preguntas de pacientes con precisión..."
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
                  {isSubmitting ? 'Guardando...' : editingService ? 'Actualizar' : 'Guardar Tratamiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
