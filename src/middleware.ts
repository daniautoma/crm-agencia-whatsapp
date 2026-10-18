import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super-secret-key-daniautoma-el-salvador-2025-cambiar-en-produccion'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas o de assets estáticos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('crm_session')?.value;
  let userSession: { role?: string; userId?: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      userSession = payload as { role?: string; userId?: string };
    } catch {
      userSession = null;
    }
  }

  // Si visita /login teniendo ya sesión activa
  if (pathname === '/login') {
    if (userSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Si visita raíz / redirigir según estado de autenticación
  if (pathname === '/') {
    if (userSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Rutas protegidas que requieren inicio de sesión
  const protectedPrefixes = [
    '/dashboard',
    '/calendar',
    '/patients',
    '/chat',
    '/services',
    '/waiting-list',
    '/settings',
  ];

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    if (!userSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // RBAC: Rutas exclusivas para Administrador
    if (pathname.startsWith('/settings') && userSession.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard?error=unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto estáticos
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
