import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos para daniautoma...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@daniautoma.cloud';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminClinica2025!';

  // 1. Configuración de la Agencia (daniautoma)
  await prisma.clinicConfig.upsert({
    where: { id: 'clinic_default' },
    update: {
      clinicName: 'daniautoma (Agencia de Automatización & IA)',
      clinicAddress: 'Remoto / Global - https://daniautoma.cloud',
      clinicPhone: '+50370000000',
      parkingInfo: 'Sesiones virtuales vía Google Meet / Zoom previa reserva.',
      holidaysJson: JSON.stringify(['2025-01-01', '2025-05-01', '2025-08-05', '2025-08-06', '2025-09-15', '2025-11-02', '2025-12-25']),
      aiModel: 'google/gemini-2.5-flash',
      aiTemperature: 0.2,
      aiBufferSeconds: 8,
      aiSystemPrompt: `Eres Esteban, el asistente virtual oficial de daniautoma, una agencia experta en agentes de WhatsApp con IA, automatizaciones de procesos con n8n y desarrollo de landing pages de alta velocidad. Tu objetivo es saludar cordialmente al cliente, explicar brevemente nuestros servicios de automatización, resolver dudas frecuentes y agendar una llamada de valoración estratégica de 30 minutos en nuestro calendario. Si el cliente solicita hablar con una persona real o requiere una propuesta compleja, cambia el estado para notificar a un agente humano.`,
      aiIsGloballyActive: true,
    },
    create: {
      id: 'clinic_default',
      clinicName: 'daniautoma (Agencia de Automatización & IA)',
      clinicAddress: 'Remoto / Global - https://daniautoma.cloud',
      clinicPhone: '+50370000000',
      parkingInfo: 'Sesiones virtuales vía Google Meet / Zoom previa reserva.',
      holidaysJson: JSON.stringify(['2025-01-01', '2025-05-01', '2025-08-05', '2025-08-06', '2025-09-15', '2025-11-02', '2025-12-25']),
      aiModel: 'google/gemini-2.5-flash',
      aiTemperature: 0.2,
      aiBufferSeconds: 8,
      aiSystemPrompt: `Eres Esteban, el asistente virtual oficial de daniautoma, una agencia experta en agentes de WhatsApp con IA, automatizaciones de procesos con n8n y desarrollo de landing pages de alta velocidad. Tu objetivo es saludar cordialmente al cliente, explicar brevemente nuestros servicios de automatización, resolver dudas frecuentes y agendar una llamada de valoración estratégica de 30 minutos en nuestro calendario. Si el cliente solicita hablar con una persona real o requiere una propuesta compleja, cambia el estado para notificar a un agente humano.`,
      aiIsGloballyActive: true,
      whatsappSessionStatus: 'DISCONNECTED',
    },
  });
  console.log('✅ Configuración oficial de daniautoma actualizada.');

  // 2. Administrador General
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Administrador daniautoma',
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      name: 'Administrador daniautoma',
      email: adminEmail,
      passwordHash: hashedAdminPassword,
      role: 'ADMIN',
      isActive: true,
      phone: '+50370000001',
    },
  });
  console.log(`✅ Usuario Administrador configurado: ${adminEmail}`);

  // 3. Equipo de Operaciones
  const opsEmail = 'operaciones@daniautoma.cloud';
  const hashedOpsPassword = await bcrypt.hash('Recepcion2025!', 10);
  await prisma.user.upsert({
    where: { email: opsEmail },
    update: {
      name: 'Equipo de Operaciones',
      role: 'RECEPTIONIST',
      isActive: true,
    },
    create: {
      name: 'Equipo de Operaciones',
      email: opsEmail,
      passwordHash: hashedOpsPassword,
      role: 'RECEPTIONIST',
      isActive: true,
      phone: '+50370000002',
    },
  });
  console.log(`✅ Operaciones creadas: ${opsEmail}`);

  // 4. Estratega / Consultor Principal (Daniel)
  const specialistEmail = 'daniel@daniautoma.cloud';
  const hashedSpecialistPassword = await bcrypt.hash('Bianca2025!', 10);
  const specialistUser = await prisma.user.upsert({
    where: { email: specialistEmail },
    update: {
      name: 'Daniel (Estratega de Automatización & IA)',
      role: 'DENTIST',
      isActive: true,
    },
    create: {
      name: 'Daniel (Estratega de Automatización & IA)',
      email: specialistEmail,
      passwordHash: hashedSpecialistPassword,
      role: 'DENTIST',
      isActive: true,
      phone: '+50370000003',
    },
  });
  console.log(`✅ Consultor Estratégico configurado: ${specialistEmail}`);

  // Perfil Profesional para agendamiento de turnos
  const professional = await prisma.professional.upsert({
    where: { userId: specialistUser.id },
    update: {
      specialty: 'Agentes de WhatsApp con IA, n8n y Arquitectura Web',
      activeDays: '1,2,3,4,5,6',
      startHour: '08:00',
      endHour: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      slotIntervalMin: 30,
    },
    create: {
      userId: specialistUser.id,
      specialty: 'Agentes de WhatsApp con IA, n8n y Arquitectura Web',
      activeDays: '1,2,3,4,5,6',
      startHour: '08:00',
      endHour: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      slotIntervalMin: 30,
    },
  });
  console.log('✅ Perfil profesional configurado para agendamiento de llamadas.');

  // 5. Catálogo Oficial de Soluciones y Servicios de daniautoma
  const daniautomaServices = [
    {
      name: 'Agente de IA en WhatsApp & CRM',
      category: 'Agentes de IA',
      description: 'Valoración estratégica de agendamiento 24/7. Agentes autónomos para captura de prospectos y atención inmediata en WhatsApp.',
      durationMinutes: 30,
      price: 0.0,
      isPriceVariable: true,
    },
    {
      name: 'Widget de Chat Web Omnicanal',
      category: 'Omnicanalidad',
      description: 'Asistente flotante para sitios web con sincronización a WhatsApp y base de conocimiento personalizada.',
      durationMinutes: 30,
      price: 0.0,
      isPriceVariable: true,
    },
    {
      name: 'Automatización de Procesos con n8n',
      category: 'Automatización',
      description: 'Flujos con Google Sheets, Resend y Webhooks. Orquestación e integración de herramientas empresariales.',
      durationMinutes: 30,
      price: 0.0,
      isPriceVariable: true,
    },
    {
      name: 'Landing Page de Alta Conversión',
      category: 'Desarrollo Web',
      description: 'Sitios estáticos de alta velocidad con Astro/Next.js enfocados en maximizar conversiones y calificación de tráfico.',
      durationMinutes: 30,
      price: 0.0,
      isPriceVariable: true,
    },
  ];

  // Desactivar servicios antiguos ajenos a daniautoma
  await prisma.service.updateMany({
    where: {
      name: {
        notIn: daniautomaServices.map((s) => s.name),
      },
    },
    data: {
      isActive: false,
    },
  });

  for (const s of daniautomaServices) {
    const service = await prisma.service.upsert({
      where: { id: `service_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}` },
      update: {
        name: s.name,
        category: s.category,
        description: s.description,
        durationMinutes: s.durationMinutes,
        price: s.price,
        isPriceVariable: s.isPriceVariable,
        isActive: true,
      },
      create: {
        id: `service_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`,
        name: s.name,
        category: s.category,
        description: s.description,
        durationMinutes: s.durationMinutes,
        price: s.price,
        isPriceVariable: s.isPriceVariable,
        isActive: true,
      },
    });

    console.log(`✅ Servicio configurado: ${service.name}`);

    await prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: {
          professionalId: professional.id,
          serviceId: service.id,
        },
      },
      create: {
        professionalId: professional.id,
        serviceId: service.id,
      },
      update: {},
    });
  }

  // 6. Lead / Contacto de ejemplo para pruebas de consulta
  const sampleLead = await prisma.patient.upsert({
    where: { phoneNormalized: '+50378901234' },
    create: {
      fullName: 'Carlos Alberto Rivas',
      phoneNormalized: '+50378901234',
      email: 'carlos.rivas@ejemplo.sv',
      tags: 'Prospecto,WhatsApp,n8n',
      generalNotes: 'Interesado en implementar agente de WhatsApp para su empresa inmobiliaria.',
      reminderPreference: 'WHATSAPP',
    },
    update: {
      tags: 'Prospecto,WhatsApp,n8n',
      generalNotes: 'Interesado en implementar agente de WhatsApp para su empresa inmobiliaria.',
    },
  });

  // Conversación de ejemplo
  await prisma.conversation.upsert({
    where: { whatsappJid: '50378901234@s.whatsapp.net' },
    create: {
      patientId: sampleLead.id,
      whatsappJid: '50378901234@s.whatsapp.net',
      status: 'OPEN',
      isAiActive: true,
    },
    update: {},
  });

  console.log('🚀 Seed de daniautoma completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
