'use client';

import React from 'react';
import { Search, Plus, Calendar as CalendarIcon } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  userRole?: string;
}

export function Header({ title, subtitle, userRole: _userRole }: HeaderProps) {
  // Hora de El Salvador aproximada o formato de fecha
  const todayStr = new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const formattedDate = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  return (
    <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        {title ? (
          <div>
            <h2 className="text-base font-semibold text-slate-900 leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <CalendarIcon className="w-3.5 h-3.5 text-brand-600" />
            <span>{formattedDate}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-semibold">El Salvador</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar paciente, teléfono o cita..."
            className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Quick action: Agendar Cita */}
        <Link
          href="/calendar?action=new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Agendar Cita</span>
        </Link>
      </div>
    </header>
  );
}
