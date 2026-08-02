import React from 'react';
import { cn } from '../../utils/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: TabItem[];
  activeId: string;
  onTabChange: (id: string) => void;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, tabs, activeId, onTabChange, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('border-b border-[#e5e5e5]', className)}
        role="tablist"
        aria-label="Hub sections"
        {...props}
      >
        <div className="flex gap-6">
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                className={cn(
                  'pb-3 pt-1 text-sm font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'text-[#5e6ad2] border-[#5e6ad2]'
                    : 'text-[#666] border-transparent hover:text-foreground'
                )}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs',
                      isActive ? 'bg-[#5e6ad2]/15 text-[#5e6ad2]' : 'bg-[#f0f0f0] text-[#666]'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

Tabs.displayName = 'Tabs';

export interface TabsPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tabId: string;
  activeId: string;
}

export const TabsPanel = React.forwardRef<HTMLDivElement, TabsPanelProps>(
  ({ className, tabId, activeId, children, ...props }, ref) => {
    if (tabId !== activeId) return null;
    return (
      <div
        ref={ref}
        id={`tabpanel-${tabId}`}
        role="tabpanel"
        aria-labelledby={`tab-${tabId}`}
        className={cn('pt-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsPanel.displayName = 'TabsPanel';
