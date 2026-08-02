/**
 * Trigger button for the workspace switcher — shows current org/workspace and opens the switcher on click.
 */

import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

export interface WorkspaceSwitcherTriggerProps {
  organizationName: string;
  workspaceName: string;
  organizationAvatar?: string | null;
  onClick?: () => void;
  isOpen?: boolean;
  /** Raw environment value from the API ('sandbox' | 'prod') */
  environment?: string;
  /** Kept for API compat — no longer rendered in the trigger */
  roleLabel?: string;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'dialog' | 'listbox';
}

export function WorkspaceSwitcherTrigger({
  organizationName,
  workspaceName,
  organizationAvatar,
  onClick,
  isOpen = false,
  environment,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHaspopup = 'listbox',
}: WorkspaceSwitcherTriggerProps) {
  const { t } = useTranslation('common');
  const initials = workspaceName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'WS';

  const envLabel = environment
    ? t(`environment.${environment}`, { defaultValue: environment.charAt(0).toUpperCase() + environment.slice(1) })
    : null;

  const isProd = environment === 'prod';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-[#f5f5f5] transition-colors group text-left"
      aria-label={ariaLabel ?? t('workspaceSwitcher.switchAria', { name: workspaceName })}
      aria-expanded={ariaExpanded ?? isOpen}
      aria-haspopup={ariaHaspopup}
    >
      {/* Workspace avatar */}
      <div
        className="w-6 h-6 rounded-md bg-gradient-to-br from-[#5e6ad2] to-[#4c5bc7] flex items-center justify-center flex-shrink-0"
        aria-hidden
      >
        {organizationAvatar ? (
          <img src={organizationAvatar} alt="" className="w-full h-full rounded-md object-cover" />
        ) : (
          <span className="text-[10px] font-semibold text-white">{initials}</span>
        )}
      </div>

      {/* Names */}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-[#0d0d0d] truncate leading-tight">{workspaceName}</div>
        <div className="text-[10px] text-[#999] truncate leading-tight">{organizationName}</div>
        {envLabel && (
          <span
            className={`inline-block mt-0.5 px-1 py-px rounded text-[9px] font-medium border leading-none ${
              isProd
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-blue-50 text-blue-600 border-blue-200'
            }`}
          >
            {envLabel}
          </span>
        )}
      </div>

      <ChevronDown
        className={`w-3 h-3 text-[#bbb] group-hover:text-[#777] flex-shrink-0 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`}
        aria-hidden
      />
    </button>
  );
}
