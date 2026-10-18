import { prisma } from "@/lib/prisma";
import { format, parseISO, startOfDay, endOfDay, addMinutes, isBefore } from "date-fns";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

// ---------------------------------------------------------------------------
// 1. ESPECIFICACIÓN DE HERRAMIENTAS (TOOLS) PARA OPENROUTER / GEMINI
// ---------------------------------------------------------------------------
export const AI_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "consultar_servicios_precios",
      description: "Consulta el catálogo de tratamientos y servicios odontológicos de la clínica con sus precios oficiales en USD y duración.",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description: "Categoría opcional: 'General', 'Limpieza', 'Restauración', 'Ortodoncia', 'Endodoncia', 'Estética', 'Cirugía', 'Urgencia'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_disponibilidad",
      description: "Consulta los horarios libres disponibles de la clínica para una fecha específica (formato YYYY-MM-DD). Permite al paciente saber qué horas están desocupadas para agendar.",
      parameters: {
        type: "object",
        properties: {
          fecha: {
            type: "string",
            description: "Fecha en formato ISO YYYY-MM-DD (por ejemplo: '2025-10-20').",
          },
          dentistaId: {
            type: "string",
            description: "ID opcional del profesional odontólogo.",
          },
        },
        required: ["fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reservar_cita",
      description: "Reserva formalmente una cita odontológica garantizando matemáticamente que no existan colisiones. Requiere haber obtenido confirmación explícita del paciente.",
      parameters: {
        type: "object",
        properties: {
          pacienteTelefono: {
            type: "string",
            description: "Número de WhatsApp o teléfono del paciente (ej: '+50371234567').",
          },
          pacienteNombre: {
            type: "string",
            description: "Nombre completo del paciente.",
          },
          servicioId: {
            type: "string",
            description: "ID del servicio odontológico seleccionado (obtenido de consultar_servicios_precios).",
          },
          fechaHoraInicio: {
            type: "string",
            description: "Fecha y hora de inicio de la cita en formato ISO YYYY-MM-DDTHH:mm:00 (ej: '2025-10-20T09:00:00').",
          },
          motivo: {
            type: "string",
            description: "Motivo breve de la consulta o notas clínicas.",
          },
          dentistaId: {
            type: "string",
            description: "ID del dentista asignado (opcional, asigna a la Dra. Bianca por defecto).",
          },
        },
        required: ["pacienteTelefono", "pacienteNombre", "servicioId", "fechaHoraInicio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_mis_citas",
      description: "Consulta las citas agendadas o pendientes de un paciente a partir de su número de teléfono de WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          pacienteTelefono: {
            type: "string",
            description: "Número de teléfono del paciente (ej: '+50371234567').",
          },
        },
        required: ["pacienteTelefono"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reprogramar_cita",
      description: "Mueve una cita existente a una nueva fecha y hora siempre que el nuevo horario esté completamente libre.",
      parameters: {
        type: "object",
        properties: {
          citaId: {
            type: "string",
            description: "ID único de la cita odontológica a reprogramar.",
          },
          nuevaFechaHoraInicio: {
            type: "string",
            description: "Nueva fecha y hora en formato ISO YYYY-MM-DDTHH:mm:00.",
          },
        },
        required: ["citaId", "nuevaFechaHoraInicio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_cita",
      description: "Cancela una cita odontológica agendada liberando el espacio para otros pacientes.",
      parameters: {
        type: "object",
        properties: {
          citaId: {
            type: "string",
            description: "ID de la cita a cancelar.",
          },
          motivo: {
            type: "string",
            description: "Razón o explicación de la cancelación proporcionada por el paciente.",
          },
        },
        required: ["citaId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalar_a_humano",
      description: "Pausa el asistente de IA y transfiere la conversación inmediatamente a recepción o al equipo médico humano cuando hay una urgencia o solicitud directa.",
      parameters: {
        type: "object",
        properties: {
          motivo: {
            type: "string",
            description: "Razón del escalamiento (ej: 'Urgencia por dolor agudo', 'Solicita hablar con Dra. Bianca').",
          },
          urgencia: {
            type: "string",
            enum: ["baja", "media", "alta"],
            description: "Nivel de urgencia detectado.",
          },
        },
        required: ["motivo", "urgencia"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// 2. EJECUTOR CENTRAL DE HERRAMIENTAS
// ---------------------------------------------------------------------------
export async function executeAiTool(
  toolName: string,
  args: Record<string, any>,
  context: { conversationId?: string; patientPhone?: string }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    switch (toolName) {
      case "consultar_servicios_precios": {
        const where: any = { isActive: true };
        if (args.categoria) {
          where.category = { contains: args.categoria };
        }
        const services = await prisma.service.findMany({
          where,
          select: {
            id: true,
            name: true,
            category: true,
            durationMinutes: true,
            price: true,
            isPriceVariable: true,
            description: true,
          },
          orderBy: { name: "asc" },
        });

        return {
          success: true,
          data: services.map((s) => ({
            id: s.id,
            nombre: s.name,
            categoria: s.category,
            duracionMinutos: s.durationMinutes,
            precio: `$${s.price.toFixed(2)}${s.isPriceVariable ? ' (Precio base variable)' : ''}`,
            descripcion: s.description || "Atención odontológica integral",
          })),
        };
      }

      case "consultar_disponibilidad": {
        const targetDate = parseISO(args.fecha);
        const dayStart = startOfDay(targetDate);
        const dayEnd = endOfDay(targetDate);

        let dentistUser = null;
        if (args.dentistaId) {
          dentistUser = await prisma.user.findUnique({
            where: { id: args.dentistaId },
          });
        } else {
          dentistUser = await prisma.user.findFirst({
            where: { role: "DENTIST" },
          });
        }

        if (!dentistUser) {
          return { success: false, error: "No hay odontólogos registrados en el sistema." };
        }

        // Obtener citas ya agendadas ese día
        const existingAppointments = await prisma.appointment.findMany({
          where: {
            professionalId: dentistUser.id,
            startTime: { gte: dayStart, lte: dayEnd },
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
          },
          select: { startTime: true, endTime: true },
        });

        const startHour = 8;
        const endHour = 17;
        const slotInterval = 30; // 30 minutos

        const availableSlots: string[] = [];
        const now = new Date();

        for (let hour = startHour; hour < endHour; hour++) {
          if (hour === 12) continue; // Almuerzo

          for (let minute = 0; minute < 60; minute += slotInterval) {
            const slotStart = new Date(targetDate);
            slotStart.setHours(hour, minute, 0, 0);
            const slotEnd = addMinutes(slotStart, slotInterval);

            if (isBefore(slotStart, now)) continue;

            const isOverlap = existingAppointments.some((apt) => {
              const aptStart = new Date(apt.startTime);
              const aptEnd = new Date(apt.endTime);
              return slotStart < aptEnd && slotEnd > aptStart;
            });

            if (!isOverlap) {
              availableSlots.push(format(slotStart, "HH:mm"));
            }
          }
        }

        return {
          success: true,
          data: {
            fecha: format(targetDate, "yyyy-MM-dd"),
            dentista: dentistUser.name,
            totalHorariosLibres: availableSlots.length,
            horariosDisponibles: availableSlots,
          },
        };
      }

      case "reservar_cita": {
        const { pacienteTelefono, pacienteNombre, servicioId, fechaHoraInicio, motivo, dentistaId } = args;

        // Limpiar número y buscar por phoneNormalized
        const digits = pacienteTelefono.replace(/\D/g, "");
        const phoneNormalized = digits.startsWith("503") ? `+${digits}` : `+503${digits}`;

        let patient = await prisma.patient.findUnique({
          where: { phoneNormalized },
        });

        if (!patient) {
          patient = await prisma.patient.create({
            data: {
              fullName: pacienteNombre,
              phoneNormalized,
              tags: "Nuevo,WhatsApp,IA",
              generalNotes: "Registrado automáticamente por el Asistente Virtual de WhatsApp.",
            },
          });
        }

        const service = await prisma.service.findUnique({
          where: { id: servicioId },
        });

        if (!service) {
          return { success: false, error: "El servicio solicitado no existe en el catálogo." };
        }

        let dentist = null;
        if (dentistaId) {
          dentist = await prisma.user.findUnique({ where: { id: dentistaId } });
        } else {
          dentist = await prisma.user.findFirst({ where: { role: "DENTIST" } });
        }

        if (!dentist) {
          return { success: false, error: "No hay odontólogo disponible para asignar." };
        }

        const start = parseISO(fechaHoraInicio);
        const end = addMinutes(start, service.durationMinutes || 30);

        // Transacción atómica anti-colisiones (Zero Double-Booking)
        const newAppointment = await prisma.$transaction(async (tx) => {
          const overlap = await tx.appointment.findFirst({
            where: {
              professionalId: dentist.id,
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
              AND: [
                { startTime: { lt: end } },
                { endTime: { gt: start } },
              ],
            },
          });

          if (overlap) {
            throw new Error(`HORARIO_OCUPADO: El horario seleccionado ya no está disponible. Por favor elige otro.`);
          }

          return await tx.appointment.create({
            data: {
              patientId: patient.id,
              professionalId: dentist.id,
              serviceId: service.id,
              startTime: start,
              endTime: end,
              status: "CONFIRMED",
              origin: "WHATSAPP_AI",
              adminNotes: motivo ? `[IA]: ${motivo}` : `[IA]: Agendado por Asistente Virtual`,
            },
            include: {
              patient: true,
              professional: true,
              service: true,
            },
          });
        });

        return {
          success: true,
          data: {
            citaId: newAppointment.id,
            paciente: newAppointment.patient.fullName,
            dentista: newAppointment.professional.name,
            servicio: newAppointment.service.name,
            fecha: format(new Date(newAppointment.startTime), "yyyy-MM-dd"),
            hora: format(new Date(newAppointment.startTime), "hh:mm a"),
            estado: newAppointment.status,
            mensaje: "¡Cita reservada con éxito sin solapamientos!",
          },
        };
      }

      case "consultar_mis_citas": {
        const phone = (args.pacienteTelefono || context.patientPhone || "").replace(/\D/g, "");
        const phoneNormalized = phone.startsWith("503") ? `+${phone}` : `+503${phone}`;

        const patient = await prisma.patient.findFirst({
          where: {
            OR: [
              { phoneNormalized },
              { phoneNormalized: { contains: phone.slice(-8) } },
            ],
          },
          include: {
            appointments: {
              where: {
                status: { notIn: ["CANCELLED"] },
                startTime: { gte: startOfDay(new Date()) },
              },
              include: { service: true, professional: true },
              orderBy: { startTime: "asc" },
            },
          },
        });

        if (!patient || patient.appointments.length === 0) {
          return {
            success: true,
            data: { mensaje: "No tienes citas activas o futuras registradas en nuestro sistema." },
          };
        }

        return {
          success: true,
          data: {
            paciente: patient.fullName,
            citas: patient.appointments.map((a) => ({
              citaId: a.id,
              servicio: a.service.name,
              odontologo: a.professional.name,
              fechaHora: format(new Date(a.startTime), "yyyy-MM-dd hh:mm a"),
              estado: a.status,
            })),
          },
        };
      }

      case "reprogramar_cita": {
        const { citaId, nuevaFechaHoraInicio } = args;
        const currentApt = await prisma.appointment.findUnique({
          where: { id: citaId },
          include: { service: true },
        });

        if (!currentApt) {
          return { success: false, error: "La cita indicada no existe." };
        }

        const newStart = parseISO(nuevaFechaHoraInicio);
        const duration = currentApt.service.durationMinutes || 30;
        const newEnd = addMinutes(newStart, duration);

        const updated = await prisma.$transaction(async (tx) => {
          const overlap = await tx.appointment.findFirst({
            where: {
              id: { not: citaId },
              professionalId: currentApt.professionalId,
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
              AND: [
                { startTime: { lt: newEnd } },
                { endTime: { gt: newStart } },
              ],
            },
          });

          if (overlap) {
            throw new Error("HORARIO_OCUPADO: El nuevo horario seleccionado ya está reservado.");
          }

          return await tx.appointment.update({
            where: { id: citaId },
            data: {
              startTime: newStart,
              endTime: newEnd,
              status: "CONFIRMED",
              adminNotes: `${currentApt.adminNotes || ""} [Reprogramada por IA al ${format(newStart, "yyyy-MM-dd HH:mm")}]`,
            },
          });
        });

        return {
          success: true,
          data: {
            citaId: updated.id,
            nuevaFecha: format(new Date(updated.startTime), "yyyy-MM-dd"),
            nuevaHora: format(new Date(updated.startTime), "hh:mm a"),
            mensaje: "Cita reprogramada con éxito.",
          },
        };
      }

      case "cancelar_cita": {
        const { citaId, motivo } = args;
        const apt = await prisma.appointment.update({
          where: { id: citaId },
          data: {
            status: "CANCELLED",
            cancelReason: motivo || "Cancelada por paciente vía WhatsApp IA",
          },
        });

        return {
          success: true,
          data: {
            citaId: apt.id,
            mensaje: "La cita ha sido cancelada satisfactoriamente y el horario quedó disponible.",
          },
        };
      }

      case "escalar_a_humano": {
        const { motivo, urgencia } = args;
        if (context.conversationId) {
          // Obtener usuario admin o el primer usuario del sistema para asignar la nota
          const adminUser = await prisma.user.findFirst({
            where: { role: "ADMIN" },
          });

          // 1. Pausar IA para esta conversación y cambiar estado a PENDING_HUMAN
          await prisma.conversation.update({
            where: { id: context.conversationId },
            data: {
              isAiActive: false,
              status: "PENDING_HUMAN",
            },
          });

          // 2. Crear nota interna visible en el buzón compartido
          if (adminUser) {
            await prisma.internalNote.create({
              data: {
                conversationId: context.conversationId,
                userId: adminUser.id,
                content: `🚨 [ESCALACIÓN AUTOMÁTICA DE IA - Urgencia: ${urgencia.toUpperCase()}]: ${motivo}`,
              },
            });
          }
        }

        return {
          success: true,
          data: {
            mensaje: "La conversación fue pausada para la IA y transferida prioritariamente al equipo humano.",
            urgencia,
          },
        };
      }

      default:
        return { success: false, error: `Herramienta desconocida: ${toolName}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Error al ejecutar herramienta clínica." };
  }
}
