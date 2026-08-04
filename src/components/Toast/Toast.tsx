import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  correlationId?: string;
  duration?: number;
}

export interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const icons = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  error: 'bg-red-50 border-red-200 text-red-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

const iconColors = {
  error: 'text-red-600',
  success: 'text-green-600',
  info: 'text-blue-600',
  warning: 'text-yellow-600',
};

export function ToastComponent({ toast, onClose }: ToastProps) {
  const { t } = useTranslation('common');
  const Icon = icons[toast.type];
  const colorClass = colors[toast.type];
  const iconColorClass = iconColors[toast.type];

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg min-w-[320px] max-w-[480px] ${colorClass}`}
      role="alert"
    >
      <Icon size={20} className={`flex-shrink-0 mt-0.5 ${iconColorClass}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{toast.title}</div>
        {toast.message && (
          <div className="text-sm mt-1 opacity-90">{toast.message}</div>
        )}
        {toast.correlationId && (
          <div className="text-xs mt-2 opacity-70 font-mono">
            ID: {toast.correlationId}
          </div>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity"
        aria-label={t('toast.closeAria')}
      >
        <X size={16} />
      </button>
    </div>
  );
}

