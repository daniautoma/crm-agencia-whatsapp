'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  User,
  Send,
  Sparkles,
  CheckCheck,
  Search,
  Lock,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { formatSVPhone } from '@/lib/utils';
import {
  sendAgentMessageAction,
  addInternalNoteAction,
  toggleConversationAiAction,
  updateConversationStatusAction,
} from '@/app/actions/chat';
import Link from 'next/link';

interface MessageItem {
  id: string;
  senderType: string;
  senderName: string | null;
  text: string;
  status: string;
  createdAt: Date | string;
}

interface InternalNoteItem {
  id: string;
  content: string;
  createdAt: Date | string;
  user: {
    name: string;
  };
}

interface ConversationItem {
  id: string;
  whatsappJid: string;
  status: string;
  isAiActive: boolean;
  lastMessageAt: Date | string;
  patient: {
    id: string;
    fullName: string;
    phoneNormalized: string;
    tags: string;
    generalNotes: string | null;
  };
  messages: MessageItem[];
  internalNotes: InternalNoteItem[];
}

interface ChatInboxProps {
  initialConversations: ConversationItem[];
  currentUserName: string;
}

export function ChatInbox({ initialConversations, currentUserName: _currentUserName }: ChatInboxProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string>(
    initialConversations[0]?.id || ''
  );
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'ai' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversationId, conversations]);

  // Conexión a SSE para recibir mensajes y eventos en tiempo real
  useEffect(() => {
    const eventSource = new EventSource('/api/whatsapp/sse');

    eventSource.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.conversationId && data.message) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === data.conversationId) {
                return {
                  ...c,
                  lastMessageAt: new Date(),
                  messages: [...c.messages, data.message],
                };
              }
              return c;
            })
          );
        }
      } catch {
        // Ignorar JSON malformado
      }
    });

    eventSource.addEventListener('conversation', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.conversationId) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === data.conversationId) {
                return {
                  ...c,
                  isAiActive: data.isAiActive !== undefined ? data.isAiActive : c.isAiActive,
                  status: data.status !== undefined ? data.status : c.status,
                  lastMessageAt: data.lastMessageAt || c.lastMessageAt,
                };
              }
              return c;
            })
          );
        }
      } catch {
        // Ignorar
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  // Filtrado de lista
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.patient.fullName.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      c.patient.phoneNormalized.includes(searchQuery.trim());

    if (!matchesSearch) return false;

    if (filterMode === 'pending') return c.status === 'PENDING_HUMAN' || !c.isAiActive;
    if (filterMode === 'ai') return c.isAiActive;
    if (filterMode === 'resolved') return c.status === 'RESOLVED';
    return true;
  });

  // Enviar mensaje o nota interna
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConversation) return;

    setIsSending(true);

    if (isInternalNote) {
      const res = await addInternalNoteAction(activeConversation.id, messageText.trim());
      if (res.success && res.note) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? { ...c, internalNotes: [...c.internalNotes, res.note as unknown as InternalNoteItem] }
              : c
          )
        );
        setMessageText('');
      }
    } else {
      const formData = new FormData();
      formData.append('conversationId', activeConversation.id);
      formData.append('text', messageText.trim());

      const res = await sendAgentMessageAction(formData);
      if (res.success && res.message) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? {
                  ...c,
                  isAiActive: false, // Regla de oro: IA pausada
                  status: 'PENDING_HUMAN',
                  messages: [...c.messages, res.message as unknown as MessageItem],
                }
              : c
          )
        );
        setMessageText('');
      }
    }

    setIsSending(false);
  };

  const handleToggleAi = async () => {
    if (!activeConversation) return;
    const nextState = !activeConversation.isAiActive;
    const res = await toggleConversationAiAction(activeConversation.id, nextState);
    if (res.success) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, isAiActive: nextState } : c))
      );
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!activeConversation) return;
    const res = await updateConversationStatusAction(activeConversation.id, newStatus);
    if (res.success) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, status: newStatus } : c))
      );
    }
  };

  // Combinar mensajes y notas cronológicamente
  const timelineItems = activeConversation
    ? [
        ...activeConversation.messages.map((m) => ({ ...m, itemType: 'message' as const })),
        ...activeConversation.internalNotes.map((n) => ({
          ...n,
          itemType: 'note' as const,
          senderType: 'INTERNAL_NOTE',
          senderName: n.user.name,
          text: n.content,
          status: 'DELIVERED',
        })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  return (
    <div className="h-[calc(100vh-7.5rem)] bg-white rounded-2xl border border-slate-200 shadow-card flex overflow-hidden">
      {/* Columna 1: Lista de Chats con Filtros */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-100 bg-slate-50/70">
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar paciente o teléfono..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-900"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                filterMode === 'pending'
                  ? 'bg-amber-100 text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Atender
            </button>
            <button
              onClick={() => setFilterMode('ai')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                filterMode === 'ai'
                  ? 'bg-purple-100 text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Con IA
            </button>
            <button
              onClick={() => setFilterMode('resolved')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                filterMode === 'resolved'
                  ? 'bg-emerald-100 text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resueltos
            </button>
          </div>
        </div>

        {/* Lista scrolleable de conversaciones */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No se encontraron conversaciones.
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeConversationId;
              const lastMsg = c.messages[c.messages.length - 1];

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConversationId(c.id)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                    isActive ? 'bg-indigo-50/50 border-l-3 border-brand-600' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900 truncate">
                      {c.patient.fullName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Intl.DateTimeFormat('es-SV', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'America/El_Salvador',
                      }).format(new Date(c.lastMessageAt))}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 truncate">
                    {lastMsg ? lastMsg.text : 'Conversación iniciada'}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {c.isAiActive ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          <Bot className="w-2.5 h-2.5" /> IA Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <User className="w-2.5 h-2.5" /> Requiere Humano
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatSVPhone(c.patient.phoneNormalized)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Columna 2: Ventana de Conversación y Timeline */}
      <div className="flex-1 flex flex-col bg-slate-50/40">
        {activeConversation ? (
          <>
            {/* Header de conversación activa */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs">
                  {activeConversation.patient.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">
                    {activeConversation.patient.fullName}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>{formatSVPhone(activeConversation.patient.phoneNormalized)}</span>
                    <span>•</span>
                    <span className="text-[10px] text-slate-400">
                      Estado: <strong>{activeConversation.status}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAi}
                  className={`px-3 py-1 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs ${
                    activeConversation.isAiActive
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {activeConversation.isAiActive ? 'Pausar IA' : 'Reactivar IA'}
                </button>
              </div>
            </div>

            {/* Banner Informativo si la IA está pausada */}
            {!activeConversation.isAiActive && (
              <div className="px-4 py-2 bg-amber-50/90 border-b border-amber-200 text-amber-800 text-[11px] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    <strong>Atención Humana Activa:</strong> La IA está pausada en esta conversación para evitar respuestas dobles.
                  </span>
                </div>
                <button
                  onClick={handleToggleAi}
                  className="font-bold text-amber-900 underline hover:no-underline text-xs"
                >
                  Reactivar
                </button>
              </div>
            )}

            {/* Timeline de Mensajes y Notas Internas */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {timelineItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Sin mensajes en esta conversación aún.
                </div>
              ) : (
                timelineItems.map((item) => {
                  const timeFormatted = new Intl.DateTimeFormat('es-SV', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/El_Salvador',
                  }).format(new Date(item.createdAt));

                  // 1. Nota Interna Privada
                  if (item.itemType === 'note') {
                    return (
                      <div
                        key={'note_' + item.id}
                        className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 max-w-lg mx-auto shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] text-amber-700 font-bold mb-1">
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3" /> NOTA INTERNA EQUIPO • {item.senderName}
                          </span>
                          <span>{timeFormatted}</span>
                        </div>
                        <p className="leading-relaxed">{item.text}</p>
                      </div>
                    );
                  }

                  // 2. Mensaje del Paciente (Entrante)
                  if (item.senderType === 'PATIENT') {
                    return (
                      <div key={'msg_' + item.id} className="flex flex-col items-start max-w-[78%]">
                        <div className="bg-white p-3 rounded-2xl rounded-tl-sm border border-slate-200 text-xs text-slate-800 shadow-xs leading-relaxed">
                          {item.text}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 ml-1">{timeFormatted}</span>
                      </div>
                    );
                  }

                  // 3. Respuesta de Asistente IA
                  if (item.senderType === 'AI') {
                    return (
                      <div key={'msg_' + item.id} className="flex flex-col items-end ml-auto max-w-[78%]">
                        <div className="bg-purple-600 text-white p-3.5 rounded-2xl rounded-tr-sm text-xs shadow-xs leading-relaxed">
                          <div className="flex items-center gap-1 text-[10px] text-purple-200 mb-1 font-semibold">
                            <Bot className="w-3 h-3" /> Asistente IA (Clínica Bianca)
                          </div>
                          {item.text}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 mr-1 flex items-center gap-1">
                          {timeFormatted} <CheckCheck className="w-3 h-3 text-brand-600" />
                        </span>
                      </div>
                    );
                  }

                  // 4. Respuesta Manual del Agente Humano
                  return (
                    <div key={'msg_' + item.id} className="flex flex-col items-end ml-auto max-w-[78%]">
                      <div className="bg-brand-600 text-white p-3.5 rounded-2xl rounded-tr-sm text-xs shadow-xs leading-relaxed">
                        <div className="flex items-center gap-1 text-[10px] text-brand-200 mb-1 font-semibold">
                          <User className="w-3 h-3" /> {item.senderName || 'Operador'} (Personal)
                        </div>
                        {item.text}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 mr-1 flex items-center gap-1">
                        {timeFormatted} <CheckCheck className="w-3 h-3 text-brand-600" />
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Caja de Composición con selector Nota vs WhatsApp */}
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setIsInternalNote(false)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                    !isInternalNote
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Mensaje WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternalNote(true)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                    isInternalNote
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Lock className="w-3 h-3" /> Nota Interna Privada
                </button>
              </div>

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    isInternalNote
                      ? 'Escriba una nota visible solo para el personal clínico...'
                      : 'Escriba un mensaje para el paciente (pausará la IA en este chat)...'
                  }
                  className={`flex-1 px-3.5 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 text-slate-900 placeholder:text-slate-400 ${
                    isInternalNote
                      ? 'bg-amber-50/50 border-amber-200 focus:ring-amber-500/20 focus:border-amber-500'
                      : 'bg-slate-50 focus:bg-white border-slate-200 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
                />
                <button
                  type="submit"
                  disabled={isSending || !messageText.trim()}
                  className={`p-2 rounded-xl text-white shadow-xs transition-colors disabled:opacity-50 ${
                    isInternalNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-brand-600 hover:bg-brand-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {!isInternalNote && (
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                  ⚡ <strong>Regla de oro:</strong> Al responder manualmente se pausa la IA para evitar mensajes redundantes.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Seleccione una conversación para iniciar el chat.
          </div>
        )}
      </div>

      {/* Columna 3: Ficha Contextual del Paciente */}
      {activeConversation && (
        <div className="w-72 border-l border-slate-200 p-4 bg-white hidden lg:flex flex-col shrink-0 justify-between">
          <div>
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-3">
              Ficha del Paciente
            </h4>
            <div className="text-center p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-base mx-auto mb-2">
                {activeConversation.patient.fullName.charAt(0)}
              </div>
              <div className="font-bold text-xs text-slate-900">
                {activeConversation.patient.fullName}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {formatSVPhone(activeConversation.patient.phoneNormalized)}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  Estado de la Conversación
                </span>
                <select
                  value={activeConversation.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                >
                  <option value="OPEN">Abierto</option>
                  <option value="PENDING_HUMAN">Requiere Atención</option>
                  <option value="RESOLVED">Resuelto / Cerrado</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Etiquetas</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {activeConversation.patient.tags.split(',').map((t) => (
                    <span key={t} className="badge badge-brand">
                      {t.trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  Notas Administrativas
                </span>
                <p className="text-slate-600 mt-0.5 text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                  {activeConversation.patient.generalNotes || 'Sin notas registradas.'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <Link
              href={`/calendar?action=new&patientId=${activeConversation.patient.id}`}
              className="w-full py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              Agendar Cita Directa
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
