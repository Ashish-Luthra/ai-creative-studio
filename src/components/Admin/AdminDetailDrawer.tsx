/**
 * Admin universal detail drawer (480px). From Figma Make universal/DetailDrawer.
 * Fixed header (title, objectType, status, scope), optional reason-code banner, tabs, scroll body, fixed footer with primary/secondary and "Why disabled?" tooltip.
 * Overflow actions appear in the "..." dropdown and destructive ones are also shown as a visible button in the footer (left side).
 */
import { ReactNode, useState, useRef, useEffect } from 'react';
import { X, MoreVertical, AlertTriangle, Lock, XCircle, ShieldAlert } from 'lucide-react';
import { StatusPill } from '@martechos/ui';

export interface AdminDetailDrawerTab {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface ReasonCodeBanner {
  type: 'blocked' | 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export type AdminDrawerStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'pending_approval'
  | 'rejected';

export interface AdminDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  status?: AdminDrawerStatus;
  objectType?: string;
  scope?: 'org-wide' | 'workspace-specific';
  tabs?: AdminDetailDrawerTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    disabledReason?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  overflowActions?: Array<{
    label: string;
    onClick: () => void;
    destructive?: boolean;
  }>;
  reasonCode?: ReasonCodeBanner;
  variant?: 'create' | 'edit' | 'view' | 'readonly' | 'blocked' | 'error' | 'permission-denied';
}

export function AdminDetailDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  status,
  objectType,
  scope,
  tabs,
  activeTab,
  onTabChange,
  children,
  footer,
  primaryAction,
  secondaryAction,
  overflowActions,
  reasonCode,
  variant = 'edit',
}: AdminDetailDrawerProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) setOverflowOpen(false);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false);
    };
    if (overflowOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [overflowOpen]);

  if (!isOpen) return null;

  const variantIcons: Record<string, ReactNode> = {
    blocked: <Lock className="w-4 h-4 text-[#d97706]" aria-hidden />,
    error: <XCircle className="w-4 h-4 text-[#dc2626]" aria-hidden />,
    'permission-denied': <ShieldAlert className="w-4 h-4 text-[#dc2626]" aria-hidden />,
  };

  const reasonCodeStyles: Record<string, string> = {
    blocked: 'bg-[#fef3c7] border-[#fde68a] text-[#92400e]',
    error: 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]',
    warning: 'bg-[#fef3c7] border-[#fde68a] text-[#92400e]',
    info: 'bg-[#dbeafe] border-[#bfdbfe] text-[#1e40af]',
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        role="presentation"
        aria-hidden
      />
      <div
        className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-2xl z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-title"
      >
        <div className="flex-shrink-0 border-b border-[#e5e5e5]">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {variantIcons[variant] ?? null}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="admin-drawer-title" className="text-[15px] font-medium text-[#0d0d0d] truncate">
                    {title}
                  </h2>
                  {objectType && (
                    <span className="inline-flex items-center justify-center px-2 h-5 rounded text-[11px] font-medium bg-[#f5f5f5] text-[#666]">
                      {objectType}
                    </span>
                  )}
                  {status && (
                    <StatusPill
                      status={status === 'blocked' ? 'blocked' : status === 'pending_approval' ? 'pending_approval' : status}
                      size="sm"
                    />
                  )}
                  {scope && (
                    <span
                      className={`inline-flex items-center justify-center px-2 h-5 rounded text-[11px] font-medium ${
                        scope === 'org-wide' ? 'bg-[#dbeafe] text-[#1e40af]' : 'bg-[#f5f5f5] text-[#666]'
                      }`}
                    >
                      {scope === 'org-wide' ? 'Org-wide' : 'Workspace'}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-[12px] text-[#666] truncate mt-0.5 font-mono">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="relative flex items-center gap-1" ref={overflowRef}>
              {overflowActions && overflowActions.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setOverflowOpen((o) => !o)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors"
                    aria-label="More actions"
                    aria-expanded={overflowOpen}
                    aria-haspopup="true"
                  >
                    <MoreVertical className="w-4 h-4 text-[#666]" />
                  </button>
                  {overflowOpen && (
                    <div
                      className="absolute top-full right-0 mt-1 py-1 min-w-[180px] bg-white border border-[#e5e5e5] rounded-md shadow-lg z-50"
                      role="menu"
                    >
                      {overflowActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            action.onClick();
                            setOverflowOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#f5f5f5] ${action.destructive ? 'text-[#dc2626]' : 'text-[#0d0d0d]'}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[#666]" />
              </button>
            </div>
          </div>

          {reasonCode && (
            <div
              className={`px-6 py-3 border-t border-b ${reasonCodeStyles[reasonCode.type] ?? reasonCodeStyles.warning}`}
              role="alert"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wide mb-0.5">
                    {reasonCode.code}
                  </div>
                  <div className="text-[13px]">{reasonCode.message}</div>
                </div>
              </div>
            </div>
          )}

          {tabs && tabs.length > 0 && (
            <div className="flex items-center gap-1 px-6 overflow-x-auto" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`h-10 px-3 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#0d0d0d] text-[#0d0d0d]'
                      : 'border-transparent text-[#666] hover:text-[#0d0d0d]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </div>

        {(footer || primaryAction || secondaryAction) && (
          <div className="flex-shrink-0 border-t border-[#e5e5e5] px-6 py-4">
            {footer ?? (
              <div className="flex items-center justify-end gap-2">
                {secondaryAction && (
                  <button
                    type="button"
                    onClick={secondaryAction.onClick}
                    className="h-8 px-3 text-[13px] text-[#666] hover:text-[#0d0d0d] transition-colors"
                  >
                    {secondaryAction.label}
                  </button>
                )}
                {primaryAction && (
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={primaryAction.onClick}
                      disabled={primaryAction.disabled}
                      title={primaryAction.disabled && primaryAction.disabledReason ? primaryAction.disabledReason : undefined}
                      className={`h-8 px-3 rounded-md text-[13px] font-medium transition-colors ${
                        primaryAction.disabled
                          ? 'bg-[#f5f5f5] text-[#999] cursor-not-allowed'
                          : 'bg-[#0d0d0d] text-white hover:bg-[#262626]'
                      }`}
                    >
                      {primaryAction.label}
                    </button>
                    {primaryAction.disabled && primaryAction.disabledReason && (
                      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10 pointer-events-none">
                        <div className="bg-[#0d0d0d] text-white text-[11px] px-2 py-1.5 rounded whitespace-nowrap shadow-lg">
                          <div className="font-medium mb-0.5">Why disabled?</div>
                          <div className="text-[#999]">{primaryAction.disabledReason}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
