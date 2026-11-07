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
      description: "Consulta el catálogo de soluciones y servicios de automatización e inteligencia artificial de daniautoma (agentes de WhatsApp, widgets omnicanal, flujos n8n y landing pages).",
      parameters: {
        type: "object",
        properties: {
          categoria: {
            type: "string",
            description: "Categoría opcional: 'Agentes de IA', 'Omnicanalidad', 'Automatización', 'Desarrollo Web'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_disponibilidad",
      description: "Consulta los horarios libres disponibles para agendar una llamada de valoración estratégica de 30 minutos para una fecha específica (formato YYYY-MM-DD). Permite al cliente saber qué espacios están desocupados.",
      parameters: {
        type: "object",
        properties: {
          fecha: {
            type: "string",
            description: "Fecha en formato ISO YYYY-MM-DD (por ejemplo: '2025-10-20').",
          },
          especialistaId: {
            type: "string",
            description: "ID opcional del consultor o especialista asignado.",
          },
          dentistaId: {
            type: "string",
            description: "Alias compatible para ID del consultor.",
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
      description: "Reserva formalmente una Llamada de Valoración Estratégica de 30 minutos en el calendario garantizando matemáticamente que no existan colisiones. Requiere haber obtenido confirmación explícita del cliente.",
      parameters: {
        type: "object",
        properties: {
          pacienteTelefono: {
            type: "string",
            description: "Número de WhatsApp o teléfono del cliente con código de país (ej: '+50371234567').",
          },
          pacienteNombre: {
            type: "string",
            description: "Nombre completo del cliente o empresa.",
          },
          servicioId: {
            type: "string",
            description: "ID del servicio o solución seleccionada (obtenido de consultar_servicios_precios).",
          },
          fechaHoraInicio: {
            type: "string",
            description: "Fecha y hora de inicio de la llamada en formato ISO YYYY-MM-DDTHH:mm:00 (ej: '2025-10-20T09:00:00').",
          },
          motivo: {
            type: "string",
            description: "Objetivo o detalles de la automatización que busca el cliente.",
          },
          dentistaId: {
            type: "string",
            description: "ID opcional del consultor asignado.",
          },
          especialistaId: {
            type: "string",
            description: "ID opcional del especialista o consultor.",
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
      description: "Consulta las llamadas de valoración estratégica agendadas o pendientes de un cliente a partir de su número de WhatsApp.",
      parameters: {
        type: "object",
        properties: {
          pacienteTelefono: {
            type: "string",
            description: "Número de teléfono o WhatsApp del cliente.",
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
      description: "Mueve una llamada de valoración estratégica existente a una nueva fecha y hora siempre que el nuevo horario esté completamente libre.",
      parameters: {
        type: "object",
        properties: {
          citaId: {
            type: "string",
            description: "ID único de la llamada de valoración a reprogramar.",
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
      description: "Cancela una llamada de valoración estratégica agendada liberando el espacio para otros clientes.",
      parameters: {
        type: "object",
        properties: {
          citaId: {
            type: "string",
            description: "ID de la llamada a cancelar.",
          },
          motivo: {
            type: "string",
            description: "Razón o explicación de la cancelación proporcionada por el cliente.",
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
      description: "Pausa el asistente de IA y transfiere la conversación inmediatamente al equipo de operaciones o a Daniel cuando el cliente solicita hablar con una persona o requiere una propuesta a medida.",
      parameters: {
        type: "object",
        properties: {
          motivo: {
            type: "string",
            description: "Razón de la transferencia (ej: 'Solicitud de atención humana', 'Proyecto de automatización complejo con ERP a medida').",
          },
          urgencia: {
            type: "string",
            enum: ["baja", "media", "alta"],
            description: "Nivel de urgencia o prioridad detectado.",
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
        const where: { isActive: boolean; category?: { contains: string } } = { isActive: true };
        if (args.categoria && typeof args.categoria === 'string') {
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
            precio: s.price === 0 ? "Gratuito (Llamada de Valoración de 30 min)" : `$${s.price.toFixed(2)}${s.isPriceVariable ? ' (Cotización personalizada)' : ''}`,
            descripcion: s.description || "Solución tecnológica de daniautoma",
          })),
        };
      }

      case "consultar_disponibilidad": {
        const targetDate = parseISO(args.fecha);
        const dayStart = startOfDay(targetDate);
        const dayEnd = endOfDay(targetDate);

        const specialistId = args.especialistaId || args.dentistaId;
        let specialistUser = null;
        if (specialistId) {
          specialistUser = await prisma.user.findUnique({
            where: { id: specialistId },
          });
        } else {
          specialistUser = await prisma.user.findFirst({
            where: { role: "DENTIST" },
          });
          if (!specialistUser) {
            specialistUser = await prisma.user.findFirst({
              where: { role: "ADMIN" },
            });
          }
        }

        if (!specialistUser) {
          return { success: false, error: "No hay consultores registrados en la agenda del sistema." };
        }

        // Obtener citas ya agendadas ese día
        const existingAppointments = await prisma.appointment.findMany({
          where: {
            professionalId: specialistUser.id,
            startTime: { gte: dayStart, lte: dayEnd },
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
          },
          select: { startTime: true, endTime: true },
        });

        const startHour = 8;
        const endHour = 18;
        const slotInterval = 30; // 30 minutos

        const availableSlots: string[] = [];
        const now = new Date();

        for (let hour = startHour; hour < endHour; hour++) {
          if (hour === 12) continue; // Receso

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
            consultor: specialistUser.name,
            totalHorariosLibres: availableSlots.length,
            horariosDisponibles: availableSlots,
          },
        };
      }

      case "reservar_cita": {
        const { pacienteTelefono, pacienteNombre, servicioId, fechaHoraInicio, motivo } = args;
        const specialistParam = args.especialistaId || args.dentistaId;

        // Limpiar número y buscar por phoneNormalized
        const digits = String(pacienteTelefono).replace(/\D/g, "");
        const phoneNormalized = digits.startsWith("503") ? `+${digits}` : (digits.length === 8 ? `+503${digits}` : `+${digits}`);

        let patient = await prisma.patient.findUnique({
          where: { phoneNormalized },
        });

        if (!patient) {
          patient = await prisma.patient.create({
            data: {
              fullName: pacienteNombre,
              phoneNormalized,
              tags: "Nuevo,WhatsApp,IA,Lead",
              generalNotes: "Lead registrado automáticamente por Esteban (Asistente Virtual de daniautoma).",
            },
          });
        }

        // Buscar servicio por id o nombre parcial
        let service = await prisma.service.findUnique({
          where: { id: servicioId },
        });

        if (!service) {
          service = await prisma.service.findFirst({
            where: {
              OR: [
                { name: { contains: servicioId } },
                { isActive: true },
              ],
            },
          });
        }

        if (!service) {
          return { success: false, error: "El servicio solicitado no existe en el catálogo de daniautoma." };
        }

        let specialist = null;
        if (specialistParam) {
          specialist = await prisma.user.findUnique({ where: { id: specialistParam } });
        }
        if (!specialist) {
          specialist = await prisma.user.findFirst({ where: { role: "DENTIST" } });
        }
        if (!specialist) {
          specialist = await prisma.user.findFirst({ where: { role: "ADMIN" } });
        }

        if (!specialist) {
          return { success: false, error: "No hay consultor disponible para asignar la llamada." };
        }

        const start = parseISO(fechaHoraInicio);
        const duration = service.durationMinutes || 30;
        const end = addMinutes(start, duration);

        // Transacción atómica anti-colisiones (Zero Double-Booking)
        const newAppointment = await prisma.$transaction(async (tx) => {
          const overlap = await tx.appointment.findFirst({
            where: {
              professionalId: specialist.id,
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
              professionalId: specialist.id,
              serviceId: service.id,
              startTime: start,
              endTime: end,
              status: "CONFIRMED",
              origin: "WHATSAPP_AI",
              adminNotes: motivo ? `[Esteban IA]: ${motivo}` : `[Esteban IA]: Llamada de Valoración Estratégica agendada`,
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
            cliente: newAppointment.patient.fullName,
            consultor: newAppointment.professional.name,
            servicio: newAppointment.service.name,
            duracionMinutos: duration,
            fecha: format(new Date(newAppointment.startTime), "yyyy-MM-dd"),
            hora: format(new Date(newAppointment.startTime), "hh:mm a"),
            estado: newAppointment.status,
            mensaje: "¡Llamada de valoración estratégica reservada con éxito en Google Meet / calendario sin solapamientos!",
          },
        };
      }

      case "consultar_mis_citas": {
        const phone = (args.pacienteTelefono || context.patientPhone || "").replace(/\D/g, "");
        const phoneNormalized = phone.startsWith("503") ? `+${phone}` : (phone.length === 8 ? `+503${phone}` : `+${phone}`);

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
            data: { mensaje: "No tienes llamadas de valoración activas o futuras registradas en nuestro sistema." },
          };
        }

        return {
          success: true,
          data: {
            cliente: patient.fullName,
            llamadas: patient.appointments.map((a) => ({
              citaId: a.id,
              servicio: a.service.name,
              consultor: a.professional.name,
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
          return { success: false, error: "La llamada o cita indicada no existe." };
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
              adminNotes: `${currentApt.adminNotes || ""} [Reprogramada por Esteban al ${format(newStart, "yyyy-MM-dd HH:mm")}]`,
            },
          });
        });

        return {
          success: true,
          data: {
            citaId: updated.id,
            nuevaFecha: format(new Date(updated.startTime), "yyyy-MM-dd"),
            nuevaHora: format(new Date(updated.startTime), "hh:mm a"),
            mensaje: "Llamada de valoración estratégica reprogramada con éxito.",
          },
        };
      }

      case "cancelar_cita": {
        const { citaId, motivo } = args;
        const apt = await prisma.appointment.update({
          where: { id: citaId },
          data: {
            status: "CANCELLED",
            cancelReason: motivo || "Cancelada por el cliente vía WhatsApp IA",
          },
        });

        return {
          success: true,
          data: {
            citaId: apt.id,
            mensaje: "La llamada de valoración estratégica ha sido cancelada satisfactoriamente y el horario quedó disponible.",
          },
        };
      }

      case "escalar_a_humano": {
        const { motivo, urgencia } = args;
        if (context.conversationId) {
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
                content: `🚨 [ESCALACIÓN A ASESOR HUMANO - Urgencia: ${String(urgencia).toUpperCase()}]: ${motivo}`,
              },
            });
          }
        }

        return {
          success: true,
          data: {
            mensaje: "La conversación fue pausada para Esteban y transferida prioritariamente a un asesor humano de daniautoma.",
            urgencia,
          },
        };
      }

      default:
        return { success: false, error: `Herramienta desconocida: ${toolName}` };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error al ejecutar herramienta de asistencia.";
    return { success: false, error: errorMsg };
  }
}
