'use client';

import React, { useState } from 'react';
import {
  Bot,
  Save,
  RotateCcw,
  Sparkles,
  Zap,
  Wrench,
  Clock,
  Eye,
  EyeOff,
  Send,
  User,
} from 'lucide-react';
import { updateAiConfigAction, simulateAiMessageAction, SimulationToolCallResult } from '@/app/actions/ai-settings';

interface AiSettingsPlaygroundProps {
  initialConfig: {
    aiModel: string;
    aiTemperature: number;
    aiBufferSeconds: number;
    aiSystemPrompt: string;
    aiIsGloballyActive: boolean;
  };
  hasApiKey: boolean;
}

export function AiSettingsPlayground({ initialConfig, hasApiKey }: AiSettingsPlaygroundProps) {
  // Estado de configuración
  const [model, setModel] = useState(initialConfig.aiModel);
  const [temperature, setTemperature] = useState(initialConfig.aiTemperature);
  const [bufferSeconds, setBufferSeconds] = useState(initialConfig.aiBufferSeconds);
  const [systemPrompt, setSystemPrompt] = useState(initialConfig.aiSystemPrompt);
  const [isGloballyActive, setIsGloballyActive] = useState(initialConfig.aiIsGloballyActive);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Estado del simulador (Playground)
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string; tools?: SimulationToolCallResult[]; latencyMs?: number }>
  >([
    {
      role: 'assistant',
      content: '¡Hola! Soy Esteban, Asistente Virtual Oficial de daniautoma. ¿En qué puedo ayudarte hoy?',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await updateAiConfigAction({
        aiModel: model,
        aiTemperature: Number(temperature),
        aiBufferSeconds: Number(bufferSeconds),
        aiSystemPrompt: systemPrompt,
        aiIsGloballyActive: isGloballyActive,
        openRouterApiKey: apiKey ? apiKey.trim() : undefined,
      });
      setSaveMessage('✅ Configuración y API Key guardadas con éxito.');
      if (apiKey) setApiKey('');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isSimulating) return;

    const userMsg = { role: 'user' as const, content: text.trim() };
    const newChatHistory = [...chatMessages, userMsg];
    setChatMessages(newChatHistory);
    setInputMessage('');
    setIsSimulating(true);

    try {
      // Filtrar historial previo para el prompt
      const historyForApi = newChatHistory.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await simulateAiMessageAction(text.trim(), historyForApi);

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          tools: res.toolsTriggered,
          latencyMs: res.latencyMs,
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ Error al conectar con OpenRouter: ${err.message}`,
        },
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  const quickPrompts = [
    { label: '💰 Precios limpieza', text: 'Hola, ¿cuánto cuesta una limpieza dental y qué incluye?' },
    { label: '📅 Horarios libres', text: '¿Qué horarios tienen disponibles para consulta este próximo sábado?' },
    { label: '🚨 Caso de urgencia', text: '¡Ayuda! Me caí en bicicleta, se me quebró un diente y estoy sangrando mucho con dolor insoportable.' },
    { label: '💊 Receta medicamento', text: 'Tengo dolor en una muela, ¿qué antibiótico me recomiendan tomar antes de ir?' },
  ];

  return (
    <div className="space-y-6">
      {/* Pestañas / Bloques: Ajustes + Playground */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* COLUMNA 1: Parámetros del Motor de IA (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Configuración del Agente IA</h3>
                  <p className="text-[11px] text-slate-500">OpenRouter (Gemini 2.5 Flash)</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGloballyActive(!isGloballyActive)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  isGloballyActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isGloballyActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isGloballyActive ? 'IA ACTIVA' : 'PAUSADA'}
              </button>
            </div>

            {/* Input API Key */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  OpenRouter API Key
                </label>
                <span className="text-[10px] text-slate-500">
                  {hasApiKey ? '● Clave registrada' : '⚠️ Clave ausente'}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={hasApiKey ? 'sk-or-v1-••••••••••••••••••••' : 'Pega tu clave sk-or-v1-...'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-3 pr-9 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                La clave se guarda de manera segura en el archivo .env del servidor.
              </p>
            </div>

            {/* Selector de Modelo y Parámetros */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo de IA</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-sans"
                >
                  <option value="google/gemini-2.5-flash">google/gemini-2.5-flash (Recomendado)</option>
                  <option value="google/gemini-2.5-pro">google/gemini-2.5-pro</option>
                  <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                  <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct</option>
                  <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buffer WhatsApp (Segundos)
                </label>
                <input
                  type="number"
                  min="3"
                  max="30"
                  value={bufferSeconds}
                  onChange={(e) => setBufferSeconds(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Temperatura (Creatividad vs Precisión)</label>
                <span className="text-xs font-mono font-bold text-brand-600">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0.0 (Preciso / Clínico)</span>
                <span>0.4 (Equilibrado)</span>
                <span>0.8 (Creativo)</span>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prompt del Sistema (Identidad, Reglas y Guardrails)
              </label>
              <textarea
                rows={7}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-sans leading-relaxed"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
            {saveMessage && <span className="text-xs font-medium text-slate-700">{saveMessage}</span>}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Guardando...' : 'Guardar Parámetros'}
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA 2: Simulador de Pruebas Clínicas en Vivo (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col h-[750px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Simulador de Agente IA (Playground)</h3>
                <p className="text-[11px] text-slate-500">Prueba el comportamiento del agente y la ejecución de herramientas</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setChatMessages([
                  {
                    role: 'assistant',
                    content: '¡Hola! Soy Esteban, Asistente Virtual Oficial de daniautoma. ¿En qué puedo ayudarte hoy?',
                  },
                ])
              }
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Reiniciar chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Prompts Rápidos */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isSimulating}
                onClick={() => handleSendMessage(qp.text)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 text-[11px] font-medium text-slate-700 hover:text-brand-700 transition-colors"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                    B
                  </div>
                )}

                <div className={`max-w-[85%] space-y-1.5`}>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white rounded-tr-none'
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/60'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Renderizado de herramientas invocadas (Function Calling) */}
                  {msg.tools && msg.tools.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {msg.tools.map((t, tIdx) => (
                        <div
                          key={tIdx}
                          className="p-2 rounded-xl bg-purple-50/80 border border-purple-200 text-[11px] text-purple-950"
                        >
                          <div className="flex items-center gap-1.5 font-bold text-purple-700 mb-1">
                            <Wrench className="w-3 h-3" />
                            <span>Herramienta: {t.toolName}</span>
                          </div>
                          <div className="text-[10px] font-mono text-purple-800 bg-white/70 p-1.5 rounded-lg border border-purple-100 overflow-x-auto">
                            <strong>Args:</strong> {JSON.stringify(t.args)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.latencyMs && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 pl-1">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{msg.latencyMs} ms</span>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isSimulating && (
              <div className="flex gap-2.5 items-center text-xs text-slate-400 italic">
                <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0 text-xs font-bold animate-pulse">
                  E
                </div>
                <span>Esteban (IA) está pensando y verificando disponibilidad de llamadas...</span>
              </div>
            )}
          </div>

          {/* Formulario de Entrada */}
          <div className="pt-3 border-t border-slate-100 mt-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Escribe un mensaje de cliente para probar a Esteban..."
                value={inputMessage}
                disabled={isSimulating}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="submit"
                disabled={isSimulating || !inputMessage.trim()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
