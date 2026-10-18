'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, clearSessionCookie, getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email('Por favor ingrese un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export async function loginAction(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validation = loginSchema.safeParse({ email, password });
  if (!validation.success) {
    return {
      error: validation.error.issues?.[0]?.message || 'Datos de inicio de sesión inválidos',
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return { error: 'Credenciales inválidas. Verifique su correo o contraseña.' };
    }

    if (!user.isActive) {
      return { error: 'Su cuenta está inactiva. Contacte a la administración.' };
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return { error: 'Credenciales inválidas. Verifique su correo o contraseña.' };
    }

    // Registrar en auditoría
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        details: JSON.stringify({ email: user.email, role: user.role }),
      },
    });

    // Guardar sesión segura HttpOnly
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'ADMIN' | 'RECEPTIONIST' | 'DENTIST',
      phone: user.phone,
    });
  } catch (err: unknown) {
    console.error('Error en loginAction:', err);
    return { error: 'Ocurrió un error en el servidor al intentar iniciar sesión.' };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'USER_LOGOUT',
          entity: 'User',
          entityId: session.userId,
        },
      });
    } catch {
      // Ignorar si falla el log durante el logout
    }
  }

  await clearSessionCookie();
  redirect('/login');
}
