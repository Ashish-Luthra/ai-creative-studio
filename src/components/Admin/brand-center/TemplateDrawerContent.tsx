/**
 * Template drawer content — Figma Make TemplateDrawerContent.
 * Tabs: Overview, Layout, Tokens, Channels, Preview, Audit.
 */
import { useTranslation } from 'react-i18next';
import { Input } from '@martechos/ui';
import { DrawerAuditTab } from '../DrawerAuditTab';
import { TabUnavailable } from '../TabUnavailable';

function FormField({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-[#0d0d0d] flex items-center gap-1">
        {label}
        {required && <span className="text-[#dc2626]" aria-hidden>*</span>}
      </label>
      <div>{children}</div>
      {help && <span className="text-[11px] text-[#666] block">{help}</span>}
    </div>
  );
}

const TYPE_OPTIONS_KEYS = ['typePush', 'typeEmail', 'typeAdCreative', 'typeInAppCard'] as const;
const TYPE_OPTIONS_VALUES = ['push', 'email', 'ad-creative', 'in-app-card'] as const;
const FORMAT_OPTIONS = ['1:1', '4:5', '9:16', '16:9', 'email-hero', 'email-full', 'mobile'];
const LOCALE_OPTIONS = ['en-US', 'en-GB', 'hi-IN', 'ta-IN', 'te-IN'];

export interface TemplateFormState {
  name?: string;
  type?: string;
  formats?: string[];
  locales?: string[];
  slots?: { name: string; type: string; required?: boolean }[];
  appliedTokens?: { category: string; token: string; appliesTo: string }[];
  channelConstraints?: Record<string, { maxLength?: number; requiredFields?: string[] }>;
}

export interface TemplateDrawerContentProps {
  data: TemplateFormState;
  onDataChange: (data: TemplateFormState) => void;
  activeTab: string;
  /** When set, Audit tab filters events by this entity id (same wiring as P2 Audit view). */
  objectRef?: string;
}

function toggleArray(arr: string[] | undefined, value: string): string[] {
  const list = arr ?? [];
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function TemplateDrawerContent({ data, onDataChange, activeTab, objectRef }: TemplateDrawerContentProps) {
  const { t } = useTranslation('admin');
  const update = (field: keyof TemplateFormState, value: unknown) => {
    onDataChange({ ...data, [field]: value });
  };

  const typeOptions = TYPE_OPTIONS_VALUES.map((val, i) => ({ value: val, label: t(`brand.drawer.template.${TYPE_OPTIONS_KEYS[i]}`) }));

  if (activeTab === 'overview') {
    const formats = data.formats ?? [];
    const locales = data.locales ?? [];
    return (
      <div className="space-y-6">
        <FormField label={t('brand.drawer.template.templateName')} required>
          <Input
            value={data.name ?? ''}
            onChange={(e) => update('name', e.target.value)}
            placeholder={t('brand.drawer.template.templateNamePlaceholder')}
            className="text-sm h-9"
            aria-label={t('brand.drawer.template.templateName')}
          />
        </FormField>
        <FormField label={t('brand.drawer.template.templateType')} required help={t('brand.drawer.template.templateTypeHelp')}>
          <select
            value={data.type ?? ''}
            onChange={(e) => update('type', e.target.value)}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.drawer.template.templateType')}
          >
            <option value="">{t('brand.drawer.template.selectTemplateType')}</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('brand.drawer.template.supportedFormats')} required>
          <div className="space-y-2">
            {FORMAT_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formats.includes(opt)}
                  onChange={() => update('formats', toggleArray(formats, opt))}
                  className="w-4 h-4 rounded border-[#e5e5e5]"
                />
                <span className="text-[13px] text-[#0d0d0d]">{opt}</span>
              </label>
            ))}
          </div>
        </FormField>
        <FormField label={t('brand.drawer.template.supportedLocales')}>
          <div className="space-y-2">
            {LOCALE_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={locales.includes(opt)}
                  onChange={() => update('locales', toggleArray(locales, opt))}
                  className="w-4 h-4 rounded border-[#e5e5e5]"
                />
                <span className="text-[13px] text-[#0d0d0d]">{opt}</span>
              </label>
            ))}
          </div>
        </FormField>
      </div>
    );
  }

  if (activeTab === 'layout') {
    const slots = data.slots ?? [];
    return (
      <div className="space-y-6">
        <FormField label={t('brand.drawer.template.layoutStructure')} help={t('brand.drawer.template.layoutStructureHelp')}>
          <div className="space-y-2">
            {slots.length === 0 ? (
              <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center text-[13px] text-[#666]">{t('brand.drawer.template.noSlotsDefined')}</div>
            ) : (
              slots.map((slot, index) => (
                <div key={index} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-medium text-[#0d0d0d]">{slot.name}</div>
                      <div className="text-[11px] text-[#666] mt-0.5">{slot.type}</div>
                    </div>
                    <span className="px-2 h-5 rounded text-[11px] font-medium bg-[#dbeafe] text-[#1e40af]">{slot.required ? t('brand.drawer.template.required') : t('brand.drawer.template.optional')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </FormField>
      </div>
    );
  }

  if (activeTab === 'tokens') {
    const appliedTokens = data.appliedTokens ?? [];
    return (
      <div className="space-y-6">
        <div className="text-[13px] text-[#666] mb-3">{t('brand.drawer.template.tokensIntro')}</div>
        {appliedTokens.length === 0 ? (
          <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center text-[13px] text-[#666]">{t('brand.drawer.template.noTokensApplied')}</div>
        ) : (
          appliedTokens.map((token, index) => (
            <div key={index} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-medium text-[#666] uppercase">{token.category}</div>
                  <div className="text-[13px] text-[#0d0d0d] font-mono mt-1">{token.token}</div>
                </div>
                <div className="text-[11px] text-[#666]">→ {token.appliesTo}</div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  if (activeTab === 'channels') {
    const constraints = data.channelConstraints ?? {};
    const entries = Object.entries(constraints);
    return (
      <div className="space-y-6">
        <FormField label={t('brand.drawer.template.channelConstraints')} help={t('brand.drawer.template.channelConstraintsHelp')}>
          <div className="space-y-3">
            {entries.length === 0 ? (
              <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center text-[13px] text-[#666]">{t('brand.drawer.template.noChannelConstraints')}</div>
            ) : (
              entries.map(([channel, c]) => (
                <div key={channel} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md">
                  <div className="text-[12px] font-medium text-[#0d0d0d] uppercase mb-2">{channel}</div>
                  <div className="text-[11px] text-[#666]">{t('brand.drawer.template.maxCharacters', { value: c.maxLength ?? 'N/A' })}</div>
                  <div className="text-[11px] text-[#666]">{t('brand.drawer.template.requiredFields', { value: c.requiredFields?.join(', ') ?? t('common.none') })}</div>
                </div>
              ))
            )}
          </div>
        </FormField>
      </div>
    );
  }

  if (activeTab === 'preview') {
    return (
      <div className="space-y-6">
        <div className="text-[13px] font-medium text-[#0d0d0d] mb-3">{t('brand.drawer.template.templatePreview')}</div>
        <div className="border-2 border-dashed border-[#e5e5e5] rounded-md p-8 text-center">
          <div className="text-[13px] text-[#666]">{t('brand.drawer.template.previewPlaceholder')}</div>
          <div className="text-[11px] text-[#999] mt-2">{t('brand.drawer.template.uploadOrSelect')}</div>
        </div>
      </div>
    );
  }

  if (activeTab === 'audit') {
    return (
      <DrawerAuditTab
        objectRefFilter={objectRef ? { resourceTypes: ['artifact'], entityId: objectRef } : undefined}
        description={t('brand.drawer.template.auditDescription')}
        emptyMessage={t('brand.drawer.template.auditEmpty')}
        enabled={true}
      />
    );
  }

  return <TabUnavailable />;
}
