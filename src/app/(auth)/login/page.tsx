'use client';

import React, { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/app/actions/auth';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-500/20 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all disabled:opacity-60 cursor-pointer"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Ingresando al sistema...
        </span>
      ) : (
        <>
          <span>Iniciar Sesión</span>
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const fillQuickCredentials = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card Principal */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 backdrop-blur-sm">
          {/* Header & Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/25 mb-4 text-2xl font-bold">
              🦷
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Clínica Dental Dra. Bianca
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Acceso a la plataforma de gestión operativa y WhatsApp
            </p>
          </div>

          {/* Mensaje de Error si existe */}
          {state?.error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Formulario */}
          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@clinicabianca.com"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  name="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>

          {/* Selector Rápido de Roles para Pruebas / Demostración */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Acceso Rápido por Rol (Demostración)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillQuickCredentials('admin@clinicabianca.com', 'AdminClinica2025!')}
                className="p-2 rounded-lg border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-[11px] font-medium text-purple-800 transition-colors text-center"
              >
                <div className="font-bold">Admin</div>
                <div className="text-[10px] text-purple-600">Total</div>
              </button>

              <button
                type="button"
                onClick={() => fillQuickCredentials('recepcion@clinicabianca.com', 'Recepcion2025!')}
                className="p-2 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-[11px] font-medium text-blue-800 transition-colors text-center"
              >
                <div className="font-bold">Recepción</div>
                <div className="text-[10px] text-blue-600">Citas & Chats</div>
              </button>

              <button
                type="button"
                onClick={() => fillQuickCredentials('bianca@clinicabianca.com', 'Bianca2025!')}
                className="p-2 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-[11px] font-medium text-emerald-800 transition-colors text-center"
              >
                <div className="font-bold">Dra. Bianca</div>
                <div className="text-[10px] text-emerald-600">Agenda</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer legal / institucional */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>Clínica Dental Dra. Bianca Nathaly Hernández Flores</p>
          <p className="text-[11px] mt-0.5">San Salvador, El Salvador • Zona Horaria America/El_Salvador</p>
        </div>
      </div>
    </div>
  );
}
