import { useState, useCallback } from 'react';

type DialogType = 'alert' | 'confirm' | 'danger';

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

const DEFAULT_STATE: DialogState = {
  isOpen: false,
  type: 'alert',
  title: '',
  message: '',
  onConfirm: () => {},
};

export function useDialog() {
  const [dialog, setDialog] = useState<DialogState>(DEFAULT_STATE);

  const closeDialog = useCallback(() => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  /** Muestra un mensaje informativo simple (reemplaza alert) */
  const showAlert = useCallback((title: string, message: string) => {
    return new Promise<void>(resolve => {
      setDialog({
        isOpen: true,
        type: 'alert',
        title,
        message,
        onConfirm: () => { closeDialog(); resolve(); },
      });
    });
  }, [closeDialog]);

  /** Muestra un diálogo de confirmación (reemplaza confirm). Retorna true si confirma. */
  const showConfirm = useCallback((title: string, message: string, confirmLabel?: string): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        confirmLabel,
        onConfirm: () => { closeDialog(); resolve(true); },
      });
    });
  }, [closeDialog]);

  /** Igual que confirm pero en rojo (para acciones destructivas) */
  const showDanger = useCallback((title: string, message: string, confirmLabel?: string): Promise<boolean> => {
    return new Promise(resolve => {
      setDialog({
        isOpen: true,
        type: 'danger',
        title,
        message,
        confirmLabel,
        onConfirm: () => { closeDialog(); resolve(true); },
      });
    });
  }, [closeDialog]);

  const dialogProps = {
    isOpen: dialog.isOpen,
    type: dialog.type,
    title: dialog.title,
    message: dialog.message,
    confirmLabel: dialog.confirmLabel,
    onConfirm: dialog.onConfirm,
    onCancel: () => { closeDialog(); },
  };

  return { dialogProps, showAlert, showConfirm, showDanger };
}
