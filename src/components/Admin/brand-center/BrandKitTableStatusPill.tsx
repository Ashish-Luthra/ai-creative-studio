/**
 * Status pill for Brand Kit table rows — matches Figma Make StatusPill (admin brand center).
 */
import { useTranslation } from 'react-i18next';

export type BrandKitTableStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'pending_approval'
  | 'rejected';

const STYLES: Record<BrandKitTableStatus, string> = {
  draft: 'bg-[#f5f5f5] text-[#666] border-[#e5e5e5]',
  in_review: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
  approved: 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]',
  in_progress: 'bg-[#dbeafe] text-[#1e40af] border-[#bfdbfe]',
  completed: 'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]',
  blocked: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
  pending_approval: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
  rejected: 'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
};

/** Map API/workspace brand kit status strings to Figma pill variants. */
export function brandKitStatusToPill(status: string | undefined): BrandKitTableStatus {
  const s = (status ?? 'active').toLowerCase();
  if (s === 'draft') return 'draft';
  // IR uses in_review for submission pending checker approval (org-wide publish).
  if (s === 'in_review') return 'pending_approval';
  if (s === 'pending_approval') return 'pending_approval';
  if (s === 'approved' || s === 'published') return 'approved';
  if (s === 'completed') return 'completed';
  if (s === 'archived') return 'blocked';
  if (s === 'active' || s === 'in_progress') return 'in_progress';
  return 'in_progress';
}

export function BrandKitTableStatusPill({ status, size = 'md' }: { status: BrandKitTableStatus; size?: 'sm' | 'md' }) {
  const { t } = useTranslation('admin');
  const sizeClasses = size === 'sm' ? 'px-2 h-5 text-[11px]' : 'px-2.5 h-6 text-[12px]';
  return (
    <span
      className={`inline-flex items-center justify-center rounded border font-medium whitespace-nowrap ${STYLES[status]} ${sizeClasses}`}
    >
      {t(`brand.tableStatusPill.${status}`)}
    </span>
  );
}
