import React, { useEffect } from 'react';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';
import { Button } from '../Button';

export interface DrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: 'left' | 'right';
  width?: string;
}

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(
  (
    {
      className,
      isOpen,
      onClose,
      title,
      position = 'right',
      width = '480px',
      children,
      ...props
    },
    ref
  ) => {
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <>
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={ref}
          className={cn(
            'fixed top-0 bottom-0 bg-white z-50 shadow-lg',
            position === 'right' ? 'right-0' : 'left-0',
            className
          )}
          style={{ width }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'drawer-title' : undefined}
          {...props}
        >
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-[#e5e5e5]">
              <h2 id="drawer-title" className="text-md font-medium">
                {title}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close drawer"
              >
                <X size={16} />
              </Button>
            </div>
          )}
          <div className="overflow-y-auto h-full">{children}</div>
        </div>
      </>
    );
  }
);

Drawer.displayName = 'Drawer';
