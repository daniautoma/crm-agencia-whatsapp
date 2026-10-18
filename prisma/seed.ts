import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@clinicabianca.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminClinica2025!';

  // 1. Configuración de la Clínica
  const existingConfig = await prisma.clinicConfig.findUnique({
    where: { id: 'clinic_default' },
  });

  if (!existingConfig) {
    await prisma.clinicConfig.create({
      data: {
        id: 'clinic_default',
        clinicName: 'Clínica Dental Dra. Bianca Nathaly Hernández Flores',
        clinicAddress: 'Calle El Mirador, Colonia Escalón, San Salvador, El Salvador',
        clinicPhone: '+50322550000',
        parkingInfo: 'Parqueo privado gratuito para pacientes frente al edificio.',
        holidaysJson: JSON.stringify(['2025-01-01', '2025-05-01', '2025-08-05', '2025-08-06', '2025-09-15', '2025-11-02', '2025-12-25']),
        aiModel: 'google/gemini-2.5-flash',
        aiTemperature: 0.2,
        aiBufferSeconds: 8,
        aiSystemPrompt: `Eres el Asistente Virtual Oficial de la Clínica Dental Dra. Bianca Nathaly Hernández Flores en El Salvador.
Tu misión es atender con calidez, respeto y terminología salvadoreña cordial ("con gusto", "a la orden", "estimado/a paciente").
Horarios: Lunes a Viernes de 8:00 AM a 5:00 PM (almuerzo de 12:00 MD a 1:00 PM), Sábados de 8:00 AM a 12:00 MD.
Reglas estrictas:
1. NUNCA diagnostiques patologías médicas ni prescribas medicamentos (prohibido recomendar analgésicos o antibióticos). Ante dolor agudo o hemorragia, deriva a urgencias de inmediato.
2. NUNCA inventes precios. Solo indica los precios autorizados obtenidos mediante tus herramientas.
3. Utiliza tus herramientas para consultar disponibilidad antes de reservar.`,
        aiIsGloballyActive: true,
        whatsappSessionStatus: 'DISCONNECTED',
      },
    });
    console.log('✅ Configuración de la clínica creada.');
  }

  // 2. Administrador
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Administrador General',
        email: adminEmail,
        passwordHash: hashedAdminPassword,
        role: 'ADMIN',
        isActive: true,
        phone: '+50370000001',
      },
    });
    console.log(`✅ Usuario Administrador creado: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Usuario Administrador existente, no se sobrescribe: ${adminEmail}`);
  }

  // 3. Recepcionista
  const recepEmail = 'recepcion@clinicabianca.com';
  const existingRecep = await prisma.user.findUnique({
    where: { email: recepEmail },
  });

  if (!existingRecep) {
    const hashedRecepPassword = await bcrypt.hash('Recepcion2025!', 10);
    await prisma.user.create({
      data: {
        name: 'Karla Morales (Recepción)',
        email: recepEmail,
        passwordHash: hashedRecepPassword,
        role: 'RECEPTIONIST',
        isActive: true,
        phone: '+50370000002',
      },
    });
    console.log(`✅ Recepcionista creada: ${recepEmail}`);
  }

  // 4. Odontóloga Principal (Dra. Bianca)
  const dentistEmail = 'bianca@clinicabianca.com';
  let dentistUser = await prisma.user.findUnique({
    where: { email: dentistEmail },
  });

  if (!dentistUser) {
    const hashedDentistPassword = await bcrypt.hash('Bianca2025!', 10);
    dentistUser = await prisma.user.create({
      data: {
        name: 'Dra. Bianca Nathaly Hernández Flores',
        email: dentistEmail,
        passwordHash: hashedDentistPassword,
        role: 'DENTIST',
        isActive: true,
        phone: '+50370000003',
      },
    });
    console.log(`✅ Odontóloga creada: ${dentistEmail}`);
  }

  // Perfil Profesional de la Dra. Bianca
  let professional = await prisma.professional.findUnique({
    where: { userId: dentistUser.id },
  });

  if (!professional) {
    professional = await prisma.professional.create({
      data: {
        userId: dentistUser.id,
        specialty: 'Odontología General y Estética Dental',
        activeDays: '1,2,3,4,5,6',
        startHour: '08:00',
        endHour: '17:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        slotIntervalMin: 30,
      },
    });
    console.log('✅ Perfil profesional creado para Dra. Bianca.');
  }

  // 5. Catálogo de Servicios Odontológicos (Precios USD)
  const defaultServices = [
    {
      name: 'Evaluación y Diagnóstico Odontológico',
      category: 'Diagnóstico',
      description: 'Revisión clínica completa con espejo e instrumental diagnóstico, evaluación periodontal y plan de tratamiento.',
      durationMinutes: 30,
      price: 15.0,
      isPriceVariable: false,
    },
    {
      name: 'Limpieza Dental Ultrasónica (Profilaxis)',
      category: 'Prevención',
      description: 'Remoción de placa bacteriana, sarro y pulido dental con pasta profiláctica y flúor.',
      durationMinutes: 45,
      price: 30.0,
      isPriceVariable: false,
    },
    {
      name: 'Restauración Estética con Resina (Calza)',
      category: 'Restauración',
      description: 'Eliminación de caries y colocación de resina fotocurable de alta estética del color dental.',
      durationMinutes: 45,
      price: 35.0,
      isPriceVariable: false,
    },
    {
      name: 'Extracción Dental Simple',
      category: 'Cirugía Menor',
      description: 'Extracción de pieza dental no compleja bajo anestesia local.',
      durationMinutes: 45,
      price: 35.0,
      isPriceVariable: false,
    },
    {
      name: 'Blanqueamiento Dental en Consultorio',
      category: 'Estética',
      description: 'Aclaramiento dental profesional con peróxido de hidrógeno activado por luz LED en 1 sola sesión.',
      durationMinutes: 60,
      price: 120.0,
      isPriceVariable: false,
    },
    {
      name: 'Tratamiento de Ortodoncia (Frenillos)',
      category: 'Ortodoncia',
      description: 'Colocación de brackets metálicos o estéticos. El precio definitivo está sujeto a valoración clínica previa.',
      durationMinutes: 60,
      price: 250.0,
      isPriceVariable: true,
    },
    {
      name: 'Endodoncia (Tratamiento de Conductos)',
      category: 'Endodoncia',
      description: 'Tratamiento de pulpa infectada en pieza unirradicular o multirradicular.',
      durationMinutes: 60,
      price: 110.0,
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

  // 6. Paciente de ejemplo para pruebas de consulta
  const samplePatient = await prisma.patient.upsert({
    where: { phoneNormalized: '+50378901234' },
    create: {
      fullName: 'Carlos Alberto Rivas',
      phoneNormalized: '+50378901234',
      email: 'carlos.rivas@ejemplo.sv',
      tags: 'Recurrente,Limpieza',
      generalNotes: 'Paciente puntual. Sensibilidad leve en molares inferiores.',
      reminderPreference: 'WHATSAPP',
    },
    update: {},
  });

  // Conversación de ejemplo
  await prisma.conversation.upsert({
    where: { whatsappJid: '50378901234@s.whatsapp.net' },
    create: {
      patientId: samplePatient.id,
      whatsappJid: '50378901234@s.whatsapp.net',
      status: 'OPEN',
      isAiActive: true,
    },
    update: {},
  });

  console.log('🚀 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
