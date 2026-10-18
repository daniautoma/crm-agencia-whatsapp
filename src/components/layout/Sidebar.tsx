'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  Sparkles,
  Clock,
  Settings,
  LogOut,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logoutAction } from '@/app/actions/auth';

interface SidebarProps {
  user: {
    userId: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'RECEPTIONIST' | 'DENTIST';
  };
  unreadChatsCount?: number;
  whatsappStatus?: 'CONNECTED' | 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING';
}

export function Sidebar({ user, unreadChatsCount = 0, whatsappStatus = 'DISCONNECTED' }: SidebarProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: 'Panel Principal',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'RECEPTIONIST', 'DENTIST'],
    },
    {
      name: 'Calendario de Citas',
      href: '/calendar',
      icon: Calendar,
      roles: ['ADMIN', 'RECEPTIONIST', 'DENTIST'],
    },
    {
      name: 'Pacientes',
      href: '/patients',
      icon: Users,
      roles: ['ADMIN', 'RECEPTIONIST', 'DENTIST'],
    },
    {
      name: 'Bandeja WhatsApp',
      href: '/chat',
      icon: MessageSquare,
      badge: unreadChatsCount > 0 ? unreadChatsCount : undefined,
      roles: ['ADMIN', 'RECEPTIONIST', 'DENTIST'],
    },
    {
      name: 'Catálogo de Servicios',
      href: '/services',
      icon: Sparkles,
      roles: ['ADMIN', 'RECEPTIONIST', 'DENTIST'],
    },
    {
      name: 'Lista de Espera',
      href: '/waiting-list',
      icon: Clock,
      roles: ['ADMIN', 'RECEPTIONIST'],
    },
    {
      name: 'Configuración & IA',
      href: '/settings',
      icon: Settings,
      roles: ['ADMIN'],
    },
  ];

  const filteredNav = navigationItems.filter((item) => item.roles.includes(user.role));

  const roleLabels: Record<string, { label: string; color: string }> = {
    ADMIN: { label: 'Administrador', color: 'bg-purple-100 text-purple-700' },
    RECEPTIONIST: { label: 'Recepción', color: 'bg-blue-100 text-blue-700' },
    DENTIST: { label: 'Odontóloga', color: 'bg-emerald-100 text-emerald-700' },
  };

  const currentRole = roleLabels[user.role] || { label: user.role, color: 'bg-slate-100 text-slate-700' };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0 fixed left-0 top-0 z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 font-bold text-lg">
            🦷
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 text-sm tracking-tight leading-tight">
              Clínica Dra. Bianca
            </h1>
            <p className="text-xs text-slate-500 font-medium">CRM Operativo V1</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Navegación
        </div>
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
                <span>{item.name}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-600 text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Operational Indicators */}
      <div className="p-3 mx-3 mb-2 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
        <div className="flex items-center justify-between font-medium text-slate-700 mb-1.5">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-slate-500" />
            WhatsApp
          </span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-semibold',
              whatsappStatus === 'CONNECTED'
                ? 'bg-emerald-100 text-emerald-800'
                : whatsappStatus === 'CONNECTING' || whatsappStatus === 'SCAN_QR'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            )}
          >
            {whatsappStatus === 'CONNECTED' ? 'En línea' : 'Desconectado'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          El Salvador (GMT-6)
        </p>
      </div>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0 border border-slate-300">
              {user.name.charAt(0)}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-900 truncate">{user.name}</div>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.2 rounded', currentRole.color)}>
                {currentRole.label}
              </span>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
