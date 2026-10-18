import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos de daniautoma...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@daniautoma.cloud';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminAutoma2025!';

  // 1. Configuración de la Agencia
  await prisma.clinicConfig.upsert({
    where: { id: 'clinic_default' },
    create: {
      id: 'clinic_default',
      clinicName: 'daniautoma (Agencia de Automatización e Inteligencia Artificial)',
      clinicAddress: 'San Salvador, El Salvador • Servicios Digitales Globales',
      clinicPhone: '+50370000000',
      parkingInfo: 'Reuniones virtuales vía Google Meet / Zoom o presenciales con cita previa.',
      holidaysJson: JSON.stringify(['2025-01-01', '2025-05-01', '2025-08-05', '2025-08-06', '2025-09-15', '2025-11-02', '2025-12-25']),
      aiModel: 'google/gemini-2.5-flash',
      aiTemperature: 0.2,
      aiBufferSeconds: 8,
      aiSystemPrompt: `Eres Esteban, el asistente virtual de daniautoma, una agencia experta en automatización con inteligencia artificial, agentes de WhatsApp y desarrollo web para negocios. Tu objetivo es saludar al cliente, explicar brevemente nuestros servicios, responder preguntas frecuentes sobre cómo la IA ayuda a conseguir más clientes y agendar una llamada de valoración estratégica de 30 minutos en nuestro calendario. Sé conciso y utiliza emojis de forma moderada. Si el usuario solicita hablar con una persona real o tiene un requerimiento técnico complejo, deriva la conversación inmediatamente a un agente humano.`,
      aiIsGloballyActive: true,
      whatsappSessionStatus: 'DISCONNECTED',
    },
    update: {
      clinicName: 'daniautoma (Agencia de Automatización e Inteligencia Artificial)',
      clinicAddress: 'San Salvador, El Salvador • Servicios Digitales Globales',
      clinicPhone: '+50370000000',
      parkingInfo: 'Reuniones virtuales vía Google Meet / Zoom o presenciales con cita previa.',
      aiSystemPrompt: `Eres Esteban, el asistente virtual de daniautoma, una agencia experta en automatización con inteligencia artificial, agentes de WhatsApp y desarrollo web para negocios. Tu objetivo es saludar al cliente, explicar brevemente nuestros servicios, responder preguntas frecuentes sobre cómo la IA ayuda a conseguir más clientes y agendar una llamada de valoración estratégica de 30 minutos en nuestro calendario. Sé conciso y utiliza emojis de forma moderada. Si el usuario solicita hablar con una persona real o tiene un requerimiento técnico complejo, deriva la conversación inmediatamente a un agente humano.`,
    },
  });
  console.log('✅ Configuración de la agencia guardada.');

  // 2. Administrador General
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: 'Admin daniautoma',
      email: adminEmail,
      passwordHash: hashedAdminPassword,
      role: 'ADMIN',
      isActive: true,
      phone: '+50370000001',
    },
    update: {
      name: 'Admin daniautoma',
      passwordHash: hashedAdminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`✅ Usuario Administrador configurado: ${adminEmail}`);

  // 3. Asistente de Operaciones
  const opsEmail = 'operaciones@daniautoma.cloud';
  const hashedOpsPassword = await bcrypt.hash('Operaciones2025!', 10);
  await prisma.user.upsert({
    where: { email: opsEmail },
    create: {
      name: 'Operaciones y Soporte',
      email: opsEmail,
      passwordHash: hashedOpsPassword,
      role: 'RECEPTIONIST',
      isActive: true,
      phone: '+50370000002',
    },
    update: {
      name: 'Operaciones y Soporte',
      role: 'RECEPTIONIST',
      isActive: true,
    },
  });
  console.log(`✅ Asistente de Operaciones configurado: ${opsEmail}`);

  // 4. Consultor Principal / Especialista en IA (Dani)
  const consultantEmail = 'dani@daniautoma.cloud';
  const hashedConsultantPassword = await bcrypt.hash('Dani2025!', 10);
  const consultantUser = await prisma.user.upsert({
    where: { email: consultantEmail },
    create: {
      name: 'Dani (Consultor Principal IA)',
      email: consultantEmail,
      passwordHash: hashedConsultantPassword,
      role: 'DENTIST',
      isActive: true,
      phone: '+50370000003',
    },
    update: {
      name: 'Dani (Consultor Principal IA)',
      role: 'DENTIST',
      isActive: true,
    },
  });
  console.log(`✅ Consultor Principal configurado: ${consultantEmail}`);

  // Perfil Profesional / Horarios del Consultor
  const professional = await prisma.professional.upsert({
    where: { userId: consultantUser.id },
    create: {
      userId: consultantUser.id,
      specialty: 'Consultoría en IA y Automatización con n8n',
      activeDays: '1,2,3,4,5', // Lunes a Viernes
      startHour: '08:00',
      endHour: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      slotIntervalMin: 30,
    },
    update: {
      specialty: 'Consultoría en IA y Automatización con n8n',
      activeDays: '1,2,3,4,5',
      startHour: '08:00',
      endHour: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      slotIntervalMin: 30,
    },
  });
  console.log('✅ Perfil y disponibilidad laboral de consultoría guardados (L-V 08:00-18:00).');

  // 5. Catálogo de Servicios de daniautoma
  const defaultServices = [
    {
      name: 'Agente de WhatsApp con IA & CRM',
      category: 'Agentes IA',
      description: 'Agente conversacional conectado a WhatsApp que agenda citas, resuelve dudas y cualifica clientes 24/7. Incluye panel de gestión.',
      durationMinutes: 30,
      price: 250.0,
      isPriceVariable: false,
    },
    {
      name: 'Automatizaciones de Procesos con n8n',
      category: 'Automatización',
      description: 'Creación de flujos de trabajo automatizados entre aplicaciones (Google Sheets, CRMs, Email, Webhooks).',
      durationMinutes: 30,
      price: 150.0,
      isPriceVariable: false,
    },
    {
      name: 'Desarrollo de Landing Page Optimizada',
      category: 'Desarrollo Web',
      description: 'Sitios web ultra-rápidos de alta conversión con integración a WhatsApp y formularios.',
      durationMinutes: 30,
      price: 200.0,
      isPriceVariable: false,
    },
    {
      name: 'Consultoría de IA & Diagnóstico Digital',
      category: 'Consultoría',
      description: 'Sesión estratégica de 45 minutos para identificar puntos de automatización en el negocio del cliente. Requiere valoración previa.',
      durationMinutes: 45,
      price: 0.0,
      isPriceVariable: true,
    },
  ];

  for (const s of defaultServices) {
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    let serviceId = existing?.id;
    if (!existing) {
      const created = await prisma.service.create({ data: s });
      serviceId = created.id;
      console.log(`✅ Servicio creado: ${s.name} ($${s.price})`);
    } else {
      await prisma.service.update({
        where: { id: existing.id },
        data: s,
      });
      console.log(`ℹ️ Servicio actualizado: ${s.name}`);
    }

    if (serviceId && professional) {
      await prisma.professionalService.upsert({
        where: {
          professionalId_serviceId: {
            professionalId: professional.id,
            serviceId: serviceId,
          },
        },
        create: {
          professionalId: professional.id,
          serviceId: serviceId,
        },
        update: {},
      });
    }
  }

  // 6. Contactos / Potenciales de ejemplo para pruebas de agencia
  const lead1 = await prisma.patient.upsert({
    where: { phoneNormalized: '+50378901234' },
    create: {
      fullName: 'Carlos Rivas (Clínica Médica Santa Fe)',
      phoneNormalized: '+50378901234',
      email: 'carlos.rivas@negocioprueba.sv',
      tags: 'Lead Calificado,WhatsApp IA',
      generalNotes: 'Interesado en implementar agente de WhatsApp para agendamiento de pacientes y recordatorios automáticos.',
      reminderPreference: 'WHATSAPP',
    },
    update: {
      fullName: 'Carlos Rivas (Clínica Médica Santa Fe)',
      tags: 'Lead Calificado,WhatsApp IA',
      generalNotes: 'Interesado en implementar agente de WhatsApp para agendamiento de pacientes y recordatorios automáticos.',
    },
  });

  const lead2 = await prisma.patient.upsert({
    where: { phoneNormalized: '+50371234567' },
    create: {
      fullName: 'Mariana López (Comercial El Roble)',
      phoneNormalized: '+50371234567',
      email: 'mariana.lopez@elroble.com',
      tags: 'Prospecto,n8n Automatización',
      generalNotes: 'Requiere sincronización de pedidos entre Shopify, Google Sheets y avisos al equipo de despacho por WhatsApp.',
      reminderPreference: 'WHATSAPP',
    },
    update: {
      fullName: 'Mariana López (Comercial El Roble)',
      tags: 'Prospecto,n8n Automatización',
      generalNotes: 'Requiere sincronización de pedidos entre Shopify, Google Sheets y avisos al equipo de despacho por WhatsApp.',
    },
  });

  // Conversación de ejemplo en bandeja
  const conv1 = await prisma.conversation.upsert({
    where: { whatsappJid: '50378901234@s.whatsapp.net' },
    create: {
      patientId: lead1.id,
      whatsappJid: '50378901234@s.whatsapp.net',
      status: 'OPEN',
      isAiActive: true,
    },
    update: {
      status: 'OPEN',
      isAiActive: true,
    },
  });

  // Mensaje de saludo inicial de prueba si no existen mensajes
  const existingMsgCount = await prisma.message.count({
    where: { conversationId: conv1.id },
  });

  if (existingMsgCount === 0) {
    await prisma.message.create({
      data: {
        conversationId: conv1.id,
        senderType: 'PATIENT',
        senderName: 'Carlos Rivas',
        text: '¡Hola! Me gustaría saber cómo funciona el Agente de WhatsApp con IA para mi clínica y agendar una llamada.',
        status: 'RECEIVED',
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conv1.id,
        senderType: 'AI',
        senderName: 'Esteban (daniautoma)',
        text: '¡Hola Carlos! 👋 Con gusto. En daniautoma desarrollamos agentes con inteligencia artificial conectados a WhatsApp que atienden 24/7, responden consultas y agendan citas automáticamente en tu calendario. ¿Te gustaría agendar una llamada de valoración estratégica de 30 minutos esta semana?',
        status: 'DELIVERED',
      },
    });
  }

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
