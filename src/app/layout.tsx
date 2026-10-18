import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'daniautoma | CRM & Asistente Virtual Oficial con IA',
  description: 'Plataforma oficial de gestión operativa, llamadas de valoración estratégica y WhatsApp multiagente con IA de daniautoma',
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
