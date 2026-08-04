import React from 'react';
import { cn } from '../../utils/cn';
import { LucideIcon, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route: string;
  /**
   * Sub-items rendered indented below the parent. They carry their own icon so
   * they survive collapse — without one a child would vanish from the rail.
   */
  children?: Array<{ id: string; label: string; route: string; icon?: LucideIcon }>;
}

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  items: SidebarItem[];
  activeItemId?: string;
  onItemClick?: (item: SidebarItem) => void;
  user?: {
    name: string;
    role: string | React.ReactNode;
    /** Short label shown below the name in Zone 2 (e.g. "Admin", "Checker") */
    subtitle?: string;
    avatar?: React.ReactNode;
  };
  onLogout?: () => void;
  /** Localised label for the sign-out button. Defaults to "Sign out". */
  logoutLabel?: string;
  /** Accessible name for the header logo. Defaults to "Allyvate". */
  appName?: string;
  /** Localised aria-label for the nav element. Defaults to "Main navigation". */
  navAriaLabel?: string;
  /** Localised label for the System section separator. Defaults to "System". */
  systemLabel?: string;
  /** Start collapsed on first load; afterwards the user's choice is remembered. */
  defaultCollapsed?: boolean;
}

const COLLAPSE_KEY = 'allyvate.sidebar.collapsed';

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      className,
      items,
      activeItemId,
      onItemClick,
      user,
      onLogout,
      logoutLabel = 'Sign out',
      appName = 'Allyvate',
      navAriaLabel = 'Main navigation',
      systemLabel = 'System',
      defaultCollapsed = false,
      ...props
    },
    ref
  ) => {
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

    // Read the stored preference after mount: server and first client render
    // must agree, so localStorage can't be consulted during render.
    React.useEffect(() => {
      try {
        const stored = window.localStorage.getItem(COLLAPSE_KEY);
        if (stored !== null) setCollapsed(stored === '1');
      } catch {
        /* private mode — fall back to the default */
      }
    }, []);

    const toggle = () => {
      setCollapsed((prev) => {
        const next = !prev;
        try {
          window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
        } catch {
          /* preference just won't persist */
        }
        return next;
      });
    };

    return (
      <div
        ref={ref}
        className={cn(
          'bg-white border-r border-[#e5e5e5] flex flex-col h-screen transition-[width] duration-150',
          // Literal, not an @theme token: a NEW theme key needs a dev-server
          // restart to appear, so the collapsed rail would silently render at
          // content width during development.
          collapsed ? 'w-[56px]' : 'w-sidebar',
          className
        )}
        {...props}
      >
        {/* Header: full wordmark, or the mark alone once collapsed. The toggle
            deliberately lives further down — at 176px the header has ~16px to
            spare beside the wordmark, not enough for a button. */}
        <div
          className={cn(
            'h-header flex items-center border-b border-[#e5e5e5]',
            collapsed ? 'justify-center px-2' : 'px-3'
          )}
        >
          {/* shrink-0: without it flex compresses the width while the height
              stays pinned, which silently distorts the wordmark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={collapsed ? '/allyvate-mark-black.svg' : '/allyvate-logo-black.svg'}
            alt={appName}
            className={cn('w-auto shrink-0', collapsed ? 'h-[26px]' : 'h-[34px]')}
          />
        </div>

        {/* Navigation */}
        <nav
          className={cn('flex-1 py-4 overflow-y-auto overflow-x-hidden', collapsed ? 'px-2' : 'px-3')}
          aria-label={navAriaLabel}
        >
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeItemId === item.id;
              const isSystemItem = item.id === 'admin';

              return (
                <React.Fragment key={item.id}>
                  {isSystemItem && !collapsed && (
                    <>
                      <li className="h-4" aria-hidden="true" />
                      <li className="px-3 pb-2 text-[11px] font-medium text-[#999] uppercase tracking-wide">
                        {systemLabel}
                      </li>
                    </>
                  )}
                  {isSystemItem && collapsed && <li className="h-3" aria-hidden="true" />}
                  <li>
                    <button
                      onClick={() => onItemClick?.(item)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'w-full h-8 text-left text-base rounded-md transition-colors flex items-center',
                        collapsed ? 'justify-center px-0' : 'px-3 gap-2',
                        isActive
                          ? 'bg-[#f0f0f0] text-foreground font-medium'
                          : 'text-mutedForeground hover:bg-[#f5f5f5]'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                  {item.children?.map((child) => {
                    const childActive = activeItemId === child.id;
                    const ChildIcon = child.icon;
                    return (
                      <li
                        key={child.id}
                        className={collapsed ? '' : 'ml-[26px] border-l border-[#e5e7eb] pl-2'}
                      >
                        <button
                          onClick={() =>
                            onItemClick?.({
                              ...item,
                              id: child.id,
                              label: child.label,
                              route: child.route,
                              children: undefined,
                            })
                          }
                          title={collapsed ? child.label : undefined}
                          className={cn(
                            'w-full rounded-md transition-colors flex items-center',
                            collapsed ? 'h-8 justify-center px-0' : 'h-7 px-2 gap-2 text-[13px]',
                            childActive
                              ? 'bg-[#f0f0f0] text-foreground font-medium'
                              : 'text-mutedForeground hover:bg-[#f5f5f5]'
                          )}
                          aria-current={childActive ? 'page' : undefined}
                        >
                          {ChildIcon && <ChildIcon size={collapsed ? 16 : 14} className="shrink-0" />}
                          {!collapsed && <span className="truncate">{child.label}</span>}
                        </button>
                      </li>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </ul>
        </nav>

        {/* Collapse toggle — its own row so it never competes with the
            wordmark for header width. */}
        <div
          className={cn(
            'border-t border-[#e5e5e5] py-1.5 flex',
            collapsed ? 'justify-center px-2' : 'justify-end px-2'
          )}
        >
          <button
            onClick={toggle}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            className="rounded-md p-1 text-[#bbb] hover:bg-[#f5f5f5] hover:text-[#555] transition-colors"
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {/* Footer */}
        {user && (
          <div className="border-t border-[#e5e5e5]">
            {/* Zone 1: workspace switcher + env badge. Dropped when collapsed —
                it has no icon-only form. */}
            {user.role && !collapsed && (
              <div className="px-2 py-2 border-b border-[#f0f0f0]">{user.role}</div>
            )}
            {/* Zone 2: user identity */}
            <div
              className={cn(
                'flex items-center',
                collapsed ? 'flex-col gap-2 px-2 py-2.5' : 'gap-2.5 px-3 py-2.5'
              )}
            >
              {user.avatar || (
                <div
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-brandGradientStart to-brandGradientEnd flex-shrink-0 flex items-center justify-center text-white text-[9px] font-semibold"
                  aria-hidden="true"
                  title={collapsed ? user.name : undefined}
                >
                  {user.name
                    .split(/[\s@._-]/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p: string) => p[0].toUpperCase())
                    .join('')}
                </div>
              )}
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-[#333] truncate leading-tight">{user.name}</div>
                  {user.subtitle && (
                    <div className="text-[10px] text-[#999] leading-tight mt-0.5">{user.subtitle}</div>
                  )}
                </div>
              )}
              {onLogout && (
                <button
                  onClick={onLogout}
                  title={logoutLabel}
                  aria-label={logoutLabel}
                  className="flex-shrink-0 text-[#bbb] hover:text-[#555] transition-colors"
                >
                  <LogOut size={13} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Sidebar.displayName = 'Sidebar';
