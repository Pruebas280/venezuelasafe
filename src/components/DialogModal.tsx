'use client';

import { useEffect } from 'react';
import { AlertTriangle, Info, X, CheckCircle2 } from 'lucide-react';

type DialogType = 'alert' | 'confirm' | 'danger';

interface DialogModalProps {
  isOpen: boolean;
  type?: DialogType;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function DialogModal({
  isOpen,
  type = 'alert',
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: DialogModalProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isConfirm = type === 'confirm' || type === 'danger';

  const icon =
    type === 'danger' ? (
      <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
    ) : type === 'confirm' ? (
      <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-7 h-7 text-amber-400" />
      </div>
    ) : (
      <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
        <Info className="w-7 h-7 text-blue-400" />
      </div>
    );

  const confirmBtnClass =
    type === 'danger'
      ? 'bg-red-500 hover:bg-red-400 text-white'
      : type === 'confirm'
      ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
      : 'bg-teal-500 hover:bg-teal-400 text-slate-900';

  const defaultConfirmLabel =
    type === 'danger' ? 'Sí, eliminar' : type === 'confirm' ? 'Confirmar' : 'Entendido';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        onClick={onCancel ?? onConfirm}
      />

      {/* Panel */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-150">
        {/* Close button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {icon}

        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">{message}</p>

        <div className={`flex gap-3 ${isConfirm ? 'flex-row' : 'flex-col'}`}>
          {isConfirm && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors active:scale-95"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 ${confirmBtnClass}`}
          >
            {confirmLabel ?? defaultConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
