import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const statusPillVariants = cva(
  'inline-flex items-center justify-center rounded-full border font-medium',
  {
    variants: {
      status: {
        draft: 'bg-[#f5f5f5] text-[#666] border-[#e5e5e5]',
        in_review: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
        approved: 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]',
        in_progress: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]',
        completed: 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]',
        blocked: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
        pending_approval: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
        rejected: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
        archived: 'bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]',
      },
      size: {
        sm: 'h-5 px-2 text-xs',
        md: 'h-6 px-2.5 text-sm',
      },
    },
    defaultVariants: {
      status: 'draft',
      size: 'md',
    },
  }
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  label?: string;
}

const statusLabels: Record<NonNullable<StatusPillProps['status']>, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  pending_approval: 'Pending Approval',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, status, size, label, ...props }, ref) => {
    const displayLabel = label || (status ? statusLabels[status] : 'Draft');

    return (
      <span
        ref={ref}
        className={cn(statusPillVariants({ status, size }), className)}
        role="status"
        aria-label={`Status: ${displayLabel}`}
        {...props}
      >
        {displayLabel}
      </span>
    );
  }
);

StatusPill.displayName = 'StatusPill';
