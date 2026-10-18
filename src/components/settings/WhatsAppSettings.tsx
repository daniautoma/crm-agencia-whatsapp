'use client';

import React, { useState, useEffect } from 'react';
import { Radio, QrCode, RotateCw, PowerOff, CheckCircle2 } from 'lucide-react';

interface WhatsAppSettingsProps {
  initialStatus: string;
  initialPhone: string | null;
  initialQr: string | null;
}

export function WhatsAppSettings({
  initialStatus,
  initialPhone,
  initialQr,
}: WhatsAppSettingsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [connectedNumber, setConnectedNumber] = useState(initialPhone);
  const [qrDataUrl, setQrDataUrl] = useState(initialQr);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Poll de estado y QR dinámico (cada 1.5s si está conectando o escaneando)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/control');
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          setConnectedNumber(data.connectedNumber);
          if (data.lastQr) {
            setQrDataUrl(data.lastQr);
          } else if (data.status === 'DISCONNECTED') {
            setQrDataUrl(null);
          }
        }
      } catch {
        // Ignorar errores de red transitorios
      }
    };

    const pollInterval = status === 'CONNECTING' || status === 'SCAN_QR' ? 1500 : 3000;
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [status]);

  const handleControl = async (action: 'start' | 'restart' | 'disconnect') => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback(data.message);
        if (action === 'disconnect') {
          setStatus('DISCONNECTED');
          setQrDataUrl(null);
          setConnectedNumber(null);
        } else if (action === 'start' || action === 'restart') {
          setStatus('CONNECTING');
        }
      } else if (data.error) {
        setFeedback(`Error: ${data.error}`);
      }
    } catch {
      setFeedback('Error de comunicación con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = status === 'CONNECTED';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Instancia de WhatsApp (Baileys)</h3>
              <p className="text-[11px] text-slate-500">Conexión socket persistente multi-sesión</p>
            </div>
          </div>

          <span
            className={`badge ${
              isConnected
                ? 'badge-success'
                : status === 'SCAN_QR' || status === 'CONNECTING'
                ? 'badge-warning'
                : 'badge-danger'
            }`}
          >
            {status}
          </span>
        </div>

        {feedback && (
          <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Visor de QR o Estado Conectado */}
        <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 text-center my-4">
          {isConnected ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">WhatsApp Conectado Exitosamente</h4>
              <p className="text-xs text-slate-500 mt-1">
                Línea oficial de la clínica activa: <strong className="text-slate-800">{connectedNumber || 'Vinculada'}</strong>
              </p>
            </div>
          ) : (
            <>
              <div className="w-44 h-44 bg-white border border-slate-200 rounded-2xl mx-auto flex flex-col items-center justify-center p-3 shadow-inner">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="Código QR de WhatsApp"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center">
                    <QrCode className="w-16 h-16 mb-2 stroke-[1.2]" />
                    <span className="text-[11px] font-medium text-slate-500">
                      {status === 'CONNECTING' ? 'Generando QR...' : 'QR no solicitado'}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3 max-w-xs mx-auto">
                Escanee este código QR desde WhatsApp en su teléfono móvil: <em>Dispositivos vinculados → Vincular un dispositivo</em>.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
        {!isConnected ? (
          <button
            disabled={isLoading}
            onClick={() => handleControl('start')}
            className="flex-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {qrDataUrl ? 'Actualizar Código QR' : 'Solicitar Nuevo QR'}
          </button>
        ) : (
          <button
            disabled={isLoading}
            onClick={() => handleControl('restart')}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Reiniciar Socket
          </button>
        )}

        <button
          disabled={isLoading || status === 'DISCONNECTED'}
          onClick={() => handleControl('disconnect')}
          className="py-2 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <PowerOff className="w-3.5 h-3.5" />
          Desconectar
        </button>
      </div>
    </div>
  );
}
