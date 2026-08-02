/**
 * Brand Kit detail/create panel — Figma Make BrandKitDrawer (480px fixed, gradient header, icon tabs, banners, footer).
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  MoreVertical,
  Palette,
  Settings,
  Type,
  Box,
  Image as ImageIcon,
  Eye,
  History,
  Lock,
  AlertCircle,
  Copy,
  Archive,
  FileCheck,
  Link2,
  ListChecks,
  BookOpen,
} from 'lucide-react';
import type { BrandKit } from '../../../hooks/useAdmin';
import { BrandKitTableStatusPill, brandKitStatusToPill } from './BrandKitTableStatusPill';
import type { BrandKitFormState } from './BrandKitDrawerContent';
import { ConfirmationModal } from '../ConfirmationModal';

import type { AdminDetailDrawerTab } from '../AdminDetailDrawer';

const TAB_ICONS: Record<string, ReactNode> = {
  overview: <Settings className="w-3.5 h-3.5" aria-hidden />,
  sources: <Link2 className="w-3.5 h-3.5" aria-hidden />,
  'extraction-review': <ListChecks className="w-3.5 h-3.5" aria-hidden />,
  logos: <ImageIcon className="w-3.5 h-3.5" aria-hidden />,
  guidelines: <BookOpen className="w-3.5 h-3.5" aria-hidden />,
  tokens: <Palette className="w-3.5 h-3.5" aria-hidden />,
  typography: <Type className="w-3.5 h-3.5" aria-hidden />,
  components: <Box className="w-3.5 h-3.5" aria-hidden />,
  preview: <Eye className="w-3.5 h-3.5" aria-hidden />,
  audit: <History className="w-3.5 h-3.5" aria-hidden />,
};

export interface BrandKitDrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  isCreating: boolean;
  selectedKit: BrandKit | null;
  formState: BrandKitFormState;
  tabs: AdminDetailDrawerTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
  errorMessage?: string | null;
  createPending?: boolean;
  updatePending?: boolean;
  onSaveDraft: () => void | Promise<void>;
  onPublish: (ctx?: { approvalReason?: string }) => void | Promise<void>;
  /** After archive modal reason is submitted — e.g. open parent delete confirmation */
  onArchiveConfirm?: () => void;
}

export function BrandKitDrawerShell({
  isOpen,
  onClose,
  isCreating,
  selectedKit,
  formState,
  tabs,
  activeTab,
  onTabChange,
  children,
  errorMessage,
  createPending,
  updatePending,
  onSaveDraft,
  onPublish,
  onArchiveConfirm,
}: BrandKitDrawerShellProps) {
  const { t } = useTranslation('admin');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [confirmReason, setConfirmReason] = useState('');
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setShowOverflowMenu(false);
      setShowPublishModal(false);
      setShowArchiveModal(false);
      setConfirmReason('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setShowOverflowMenu(false);
    };
    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOverflowMenu]);

  if (!isOpen) return null;

  const name = (formState.name ?? '').trim();
  const scope = formState.scope ?? '';
  const owner = (formState.owner ?? '').trim();
  const hasWorkspace = (formState.workspaces?.length ?? 0) > 0;

  const figmaRequiredMet = Boolean(name && scope && owner);
  const canCreate = figmaRequiredMet && hasWorkspace;
  const canEditActions = Boolean(name.trim());

  const canFooterPrimary = isCreating ? canCreate : canEditActions;

  const requiresApproval = scope === 'org-wide';
  const hasValidationErrors = isCreating && (!name || !scope || !owner || !hasWorkspace);

  const handlePublishClick = async () => {
    if (requiresApproval) {
      setShowPublishModal(true);
      return;
    }
    try {
      await Promise.resolve(onPublish());
      onClose();
    } catch {
      /* Parent sets errorMessage */
    }
  };

  const handleConfirmPublish = async () => {
    if (!confirmReason.trim()) return;
    const reason = confirmReason.trim();
    setShowPublishModal(false);
    setConfirmReason('');
    try {
      await Promise.resolve(onPublish({ approvalReason: reason }));
      onClose();
    } catch {
      /* Parent sets errorMessage */
    }
  };

  const handleConfirmArchive = () => {
    if (!confirmReason.trim()) return;
    setShowArchiveModal(false);
    onArchiveConfirm?.();
    setConfirmReason('');
  };

  const statusPill = selectedKit ? brandKitStatusToPill(selectedKit.status) : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} role="presentation" aria-hidden />

      <div
        className="fixed right-0 top-0 bottom-0 w-[480px] bg-white border-l border-[#e5e5e5] flex flex-col shadow-lg z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-kit-drawer-title"
      >
        <div className="border-b border-[#e5e5e5] flex-shrink-0">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded bg-gradient-to-br from-[#ec4899] to-[#f97316] flex items-center justify-center flex-shrink-0">
                <Palette className="w-5 h-5 text-white" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="brand-kit-drawer-title" className="text-[15px] font-medium text-[#0d0d0d] truncate">
                  {isCreating ? t('brand.brandKitDrawerShell.createTitle') : selectedKit?.name ?? t('brand.brandKitDrawerShell.defaultKitName')}
                </h2>
                {!isCreating && selectedKit && (
                  <div className="text-[11px] text-[#666] font-mono">
                    {selectedKit.id}@v{selectedKit.version ?? '1'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isCreating ? (
                <div className="w-8 h-8 flex-shrink-0" aria-hidden />
              ) : (
                <div className="relative" ref={overflowRef}>
                  <button
                    type="button"
                    onClick={() => setShowOverflowMenu((o) => !o)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors"
                    aria-label={t('brand.brandKitDrawerShell.ariaMoreActions')}
                    aria-expanded={showOverflowMenu}
                  >
                    <MoreVertical className="w-4 h-4 text-[#666]" />
                  </button>
                  {showOverflowMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#e5e5e5] rounded-md shadow-lg py-1 z-10">
                      <button
                        type="button"
                        onClick={() => setShowOverflowMenu(false)}
                        className="w-full px-3 h-8 flex items-center gap-2 text-[13px] text-[#0d0d0d] hover:bg-[#f5f5f5] transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        {t('brand.brandKitDrawerShell.duplicate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowArchiveModal(true);
                          setShowOverflowMenu(false);
                        }}
                        className="w-full px-3 h-8 flex items-center gap-2 text-[13px] text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                        {t('brand.brandKitDrawerShell.archive')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onTabChange('audit');
                          setShowOverflowMenu(false);
                        }}
                        className="w-full px-3 h-8 flex items-center gap-2 text-[13px] text-[#0d0d0d] hover:bg-[#f5f5f5] transition-colors"
                      >
                        <FileCheck className="w-4 h-4" />
                        {t('brand.brandKitDrawerShell.viewAudit')}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center hover:bg-[#f5f5f5] rounded transition-colors"
                aria-label={t('brand.brandKitDrawerShell.ariaClose')}
              >
                <X className="w-4 h-4 text-[#666]" />
              </button>
            </div>
          </div>

          <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center justify-center px-2 h-5 rounded text-[11px] font-medium bg-[#e9d5ff] text-[#6b21a8]">
              {t('brand.brandKitDrawerShell.badgeBrandKit')}
            </span>
            {!isCreating && statusPill && <BrandKitTableStatusPill status={statusPill} size="sm" />}
            {scope && (
              <span
                className={`inline-flex items-center justify-center px-2 h-5 rounded text-[11px] font-medium ${
                  scope === 'org-wide' ? 'bg-[#dbeafe] text-[#1e40af]' : 'bg-[#fef3c7] text-[#92400e]'
                }`}
              >
                {scope === 'org-wide' ? t('brand.common.orgWide') : t('brand.common.workspaceSpecific')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 px-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 h-10 text-[13px] border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-[#0d0d0d] text-[#0d0d0d] font-medium'
                    : 'border-transparent text-[#666] hover:text-[#0d0d0d]'
                }`}
              >
                {tab.icon ?? TAB_ICONS[tab.id]}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <div className="p-6">
            {hasValidationErrors && activeTab === 'overview' && (
              <div className="bg-[#fee2e2] border border-[#fecaca] rounded-md p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#991b1b] flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="text-[12px] text-[#991b1b]">
                    <div className="font-medium mb-1">{t('brand.brandKitDrawerShell.validationFailedTitle')}</div>
                    <div>{t('brand.brandKitDrawerShell.validationFailedBody')}</div>
                  </div>
                </div>
              </div>
            )}

            {requiresApproval && !isCreating && activeTab === 'overview' && (
              <div className="bg-[#fef3c7] border border-[#fde68a] rounded-md p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-[#92400e] flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="text-[12px] text-[#92400e]">
                    <div className="font-medium mb-1">{t('brand.brandKitDrawerShell.approvalRequiredTitle')}</div>
                    <div>{t('brand.brandKitDrawerShell.approvalRequiredBody')}</div>
                  </div>
                </div>
              </div>
            )}

            {children}

            {errorMessage && (
              <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] rounded text-sm" role="alert">
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#e5e5e5] px-6 py-4 bg-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 text-[13px] text-[#666] hover:text-[#0d0d0d] transition-colors"
            >
              {t('brand.brandKitDrawerShell.cancel')}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onSaveDraft()}
                disabled={!canFooterPrimary || createPending || updatePending}
                className="h-8 px-3 border border-[#e5e5e5] text-[#0d0d0d] rounded-md text-[13px] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('brand.brandKitDrawerShell.saveDraft')}
              </button>
              <button
                type="button"
                onClick={() => void handlePublishClick()}
                disabled={!canFooterPrimary || createPending || updatePending}
                className="h-8 px-3 bg-[#0d0d0d] text-white rounded-md text-[13px] hover:bg-[#262626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={
                  !canFooterPrimary
                    ? isCreating
                      ? t('brand.brandKitDrawerShell.titleTooltipComplete')
                      : t('brand.brandKitDrawerShell.titleTooltipName')
                    : requiresApproval
                      ? t('brand.brandKitDrawerShell.titleTooltipApproval')
                      : ''
                }
              >
                {requiresApproval && <Lock className="w-3.5 h-3.5" aria-hidden />}
                {t('brand.brandKitDrawerShell.publish')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showPublishModal}
        onClose={() => {
          setShowPublishModal(false);
          setConfirmReason('');
        }}
        onConfirm={() => void handleConfirmPublish()}
        title={t('brand.brandKitDrawerShell.publishTitle')}
        message={t('brand.brandKitDrawerShell.publishMessage', { name: name || t('brand.brandKitDrawerShell.defaultKitName') })}
        confirmText={t('brand.brandKitDrawerShell.confirmRequestApproval')}
        variant="warning"
        reasonCode="APPROVAL_REQUIRED"
        requireReason
        reason={confirmReason}
        onReasonChange={setConfirmReason}
        reasonLabel={t('brand.brandKitDrawerShell.reasonPublishLabel')}
        reasonPlaceholder={t('brand.brandKitDrawerShell.reasonPublishPlaceholder')}
      />

      <ConfirmationModal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setConfirmReason('');
        }}
        onConfirm={handleConfirmArchive}
        title={t('brand.brandKitDrawerShell.archiveTitle')}
        message={t('brand.brandKitDrawerShell.archiveMessage')}
        confirmText={t('brand.brandKitDrawerShell.confirmArchive')}
        variant="danger"
        reasonCode="ARCHIVE_REQUESTED"
        requireReason
        reason={confirmReason}
        onReasonChange={setConfirmReason}
        reasonLabel={t('brand.brandKitDrawerShell.reasonArchiveLabel')}
        reasonPlaceholder={t('brand.brandKitDrawerShell.reasonArchivePlaceholder')}
      />
    </>
  );
}
