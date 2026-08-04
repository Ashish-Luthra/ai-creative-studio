import React from 'react';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export type StatusIconStatus = 'success' | 'failed' | 'running' | 'pending' | 'queued' | 'stopped' | 'cancelled';

export interface StatusIconProps {
  status: StatusIconStatus;
  size?: number;
  className?: string;
}

const statusConfig: Record<StatusIconStatus, { icon: typeof CheckCircle2; color: string }> = {
  success: {
    icon: CheckCircle2,
    color: '#059669', // green-600
  },
  failed: {
    icon: XCircle,
    color: '#dc2626', // red-600
  },
  running: {
    icon: Loader2,
    color: '#f59e0b', // amber-500
  },
  pending: {
    icon: Clock,
    color: '#6b7280', // gray-500
  },
  queued: {
    icon: Clock,
    color: '#6b7280', // gray-500
  },
  stopped: {
    icon: XCircle,
    color: '#6b7280', // gray-500
  },
  cancelled: {
    icon: XCircle,
    color: '#6b7280', // gray-500
  },
};

export function StatusIcon({ status, size = 16, className }: StatusIconProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === 'running';

  return (
    <Icon
      size={size}
      className={cn(
        isAnimated && 'animate-spin',
        className
      )}
      style={{ color: config.color } as React.CSSProperties}
    />
  );
}

