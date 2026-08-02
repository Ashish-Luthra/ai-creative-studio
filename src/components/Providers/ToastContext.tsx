import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType } from '../Toast/Toast';
import { ToastContainer } from '../Toast/ToastContainer';

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, correlationId?: string, duration?: number) => void;
  showError: (title: string, message?: string, correlationId?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, correlationId?: string, duration = 5000) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        type,
        title,
        message,
        correlationId,
        duration,
      };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const showError = useCallback(
    (title: string, message?: string, correlationId?: string) => {
      showToast('error', title, message, correlationId, 8000); // Errors stay longer
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => {
      showToast('success', title, message, undefined, 3000);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string) => {
      showToast('info', title, message, undefined, 4000);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string) => {
      showToast('warning', title, message, undefined, 5000);
    },
    [showToast]
  );

  const handleClose = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo, showWarning }}>
      {children}
      <ToastContainer toasts={toasts} onClose={handleClose} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

