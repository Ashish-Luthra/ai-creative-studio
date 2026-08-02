/**
 * Per-row overflow menu (⋮) for admin list tables. Opens a dropdown with row-specific
 * actions (Open, Delete, View audit, etc.). Matches AdminDetailDrawer overflow styling.
 */
import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export interface AdminRowAction {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export interface AdminRowActionsMenuProps {
  actions: AdminRowAction[];
  /** Optional aria-label for the trigger (default: "Row actions") */
  'aria-label'?: string;
}

export function AdminRowActionsMenu({ actions, 'aria-label': ariaLabel = 'Row actions' }: AdminRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="relative flex items-center justify-center" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-8 h-8 flex items-center justify-center hover:bg-[#f0f0f0] rounded transition-colors"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MoreVertical className="w-4 h-4 text-[#666]" aria-hidden />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 py-1 min-w-[160px] bg-white border border-[#e5e5e5] rounded-md shadow-lg z-50"
          role="menu"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#f5f5f5] ${action.destructive ? 'text-[#dc2626]' : 'text-[#0d0d0d]'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
