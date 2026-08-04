import React from 'react';
import { cn } from '../../utils/cn';
import { Sparkles } from 'lucide-react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  gradient?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, icon, gradient = false, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-6 h-6',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-full flex items-center justify-center flex-shrink-0',
          sizeClasses[size],
          gradient
            ? 'bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6]'
            : 'bg-brandPrimary',
          className
        )}
        role="img"
        aria-label="Avatar"
        {...props}
      >
        {icon ? (
          <span className="text-white text-xs">{icon}</span>
        ) : (
          <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

