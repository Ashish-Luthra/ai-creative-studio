/**
 * Confirmation modal for destructive or sensitive actions. From Figma Make universal/ConfirmationModal.
 * Supports variant (warning | danger | info), optional required reason, and reasonCode display.
 */
import { X, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
  requireReason?: boolean;
  reason?: string;
  onReasonChange?: (reason: string) => void;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonCode?: string;
  disabled?: boolean;
  /** Error message to show when confirm failed (e.g. API error). */
  error?: string | null;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  requireReason = false,
  reason = '',
  onReasonChange,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Provide a reason for audit trail...',
  reasonCode,
  disabled = false,
  error,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    warning: {
      bg: 'bg-[#fef3c7]',
      border: 'border-[#fde68a]',
      text: 'text-[#92400e]',
      icon: AlertTriangle,
    },
    danger: {
      bg: 'bg-[#fee2e2]',
      border: 'border-[#fecaca]',
      text: 'text-[#991b1b]',
      icon: AlertCircle,
    },
    info: {
      bg: 'bg-[#dbeafe]',
      border: 'border-[#bfdbfe]',
      text: 'text-[#1e40af]',
      icon: CheckCircle2,
    },
  };

  const style = variantStyles[variant];
  const Icon = style.icon;
  const canConfirm = !disabled && (!requireReason || reason.trim().length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" role="dialog" aria-modal="true" aria-labelledby="confirmation-modal-title">
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[90vw] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5e5] flex-shrink-0">
          <h2 id="confirmation-modal-title" className="text-[15px] font-medium text-[#0d0d0d]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[#666]" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-auto flex-1">
          <div className={`${style.bg} border ${style.border} rounded-md p-3`}>
            <div className="flex items-start gap-2">
              <Icon className={`w-4 h-4 ${style.text} flex-shrink-0 mt-0.5`} aria-hidden />
              <div className={`text-[12px] ${style.text}`}>
                {reasonCode && <div className="font-medium mb-1">{reasonCode}</div>}
                <div>{message}</div>
              </div>
            </div>
          </div>

          {requireReason && (
            <div>
              <label htmlFor="confirmation-reason" className="block text-[13px] font-medium text-[#0d0d0d] mb-1.5">
                {reasonLabel} <span className="text-[#dc2626]">*</span>
              </label>
              <textarea
                id="confirmation-reason"
                value={reason}
                onChange={(e) => onReasonChange?.(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] focus:ring-1 focus:ring-[#0d0d0d] resize-none"
              />
            </div>
          )}
          {error && (
            <div className="bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] rounded-md p-3 text-[13px]" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e5e5e5] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 text-[13px] text-[#666] hover:text-[#0d0d0d] transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`h-8 px-3 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              variant === 'danger'
                ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
                : 'bg-[#0d0d0d] text-white hover:bg-[#262626]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
