import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brandPrimary text-white hover:bg-brandPrimaryHover',
        primary: 'bg-brandPrimary text-white hover:bg-brandPrimaryHover',
        destructive: 'bg-destructive text-destructiveForeground hover:opacity-90',
        outline: 'border border-border bg-transparent hover:bg-accent',
        secondary: 'bg-secondary text-secondaryForeground hover:opacity-80',
        ghost: 'hover:bg-accent',
        link: 'underline-offset-4 hover:underline text-primary',
      },
      size: {
        default: 'h-9 px-4 text-base',
        sm: 'h-8 px-3 text-base',
        lg: 'h-10 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      icon,
      iconPosition = 'left',
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <span className="mr-2" aria-label="Loading">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        ) : icon && iconPosition === 'left' ? (
          <span className="mr-2" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {children}
        {icon && iconPosition === 'right' && !loading ? (
          <span className="ml-2" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';
