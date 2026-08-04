import React from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  examples?: string[];
  /** Label for the examples section when present. Default: "Examples". Pass a translated string for i18n. */
  examplesLabel?: string;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, examples, examplesLabel = 'Examples', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center h-full bg-white',
          className
        )}
        {...props}
      >
        {icon && (
          <div
            className="w-16 h-16 rounded-full bg-[#f0f0ff] flex items-center justify-center mb-4"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
        <p className="text-base text-mutedForeground leading-relaxed max-w-[448px] text-center mb-6">
          {description}
        </p>
        {action && (
          <Button
            icon={action.icon}
            onClick={action.onClick}
            variant="primary"
            size="lg"
          >
            {action.label}
          </Button>
        )}
        {examples && examples.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#e5e5e5]">
            <p className="text-xs text-[#999] uppercase tracking-wider mb-3">{examplesLabel}</p>
            <ul className="text-sm text-mutedForeground text-left space-y-1">
              {examples.map((example, index) => (
                <li key={index}>{example}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
