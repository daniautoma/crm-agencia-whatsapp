import { getSession, SessionPayload } from './session';
import { prisma } from '../prisma';

export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'DENTIST';

export const Roles = {
  ADMIN: 'ADMIN' as UserRole,
  RECEPTIONIST: 'RECEPTIONIST' as UserRole,
  DENTIST: 'DENTIST' as UserRole,
};

export async function getCurrentUser(): Promise<SessionPayload | null> {
  return await getSession();
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED: No hay sesión activa.');
  }

  // Verificar si el usuario sigue activo en la base de datos
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, role: true, name: true, email: true },
  });

  if (!user || !user.isActive) {
    throw new Error('FORBIDDEN: Usuario inactivo o inexistente.');
  }

  return session;
}

export async function requireRole(allowedRoles: UserRole[]): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    throw new Error(`FORBIDDEN: Permisos insuficientes. Se requiere uno de los roles: [${allowedRoles.join(', ')}]`);
  }
  return session;
}

export function canAccessModule(role: UserRole, module: string): boolean {
  switch (module) {
    case 'settings':
    case 'users':
    case 'audit':
      return role === 'ADMIN';
    case 'waiting_list':
    case 'services_edit':
      return role === 'ADMIN' || role === 'RECEPTIONIST';
    case 'chat':
    case 'calendar':
    case 'patients':
    case 'dashboard':
      return true; // Todos con su respectivo filtro
    default:
      return false;
  }
}
