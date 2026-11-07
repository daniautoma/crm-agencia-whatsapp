import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'daniautoma | CRM Operativo & Agente de WhatsApp',
  description: 'CRM Operativo y Asistente Autónomo de WhatsApp para daniautoma (Agencia de Automatización & IA)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
