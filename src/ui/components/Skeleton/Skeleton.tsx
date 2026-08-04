import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'rectangular', ...props }, ref) => {
    const baseStyles = 'animate-pulse bg-accent rounded';
    
    const variantStyles = {
      text: 'h-4 w-full',
      circular: 'rounded-full',
      rectangular: 'rounded',
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], className)}
        aria-busy="true"
        aria-label="Loading"
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
