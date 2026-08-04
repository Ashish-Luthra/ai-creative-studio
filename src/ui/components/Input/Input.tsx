import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, icon, iconPosition = 'left', ...props }, ref) => {
    const hasIcon = !!icon;

    return (
      <div className="relative inline-block w-full">
        {icon && iconPosition === 'left' && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-mutedForeground pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          type={type}
          className={cn(
            'h-9 w-full rounded border bg-inputBackground px-3 text-base',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            hasIcon && iconPosition === 'left' && 'pl-9',
            hasIcon && iconPosition === 'right' && 'pr-9',
            error
              ? 'border-destructive focus:ring-destructive'
              : 'border-border focus:ring-brandPrimary',
            className
          )}
          ref={ref}
          aria-invalid={error}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-mutedForeground pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
