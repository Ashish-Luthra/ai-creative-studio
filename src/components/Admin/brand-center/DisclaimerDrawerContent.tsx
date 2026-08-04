/**
 * Disclaimer drawer content — Figma Make DisclaimerDrawerContent.
 * Tabs: Overview, Applies-to, Localization, Audit.
 */
import { useTranslation } from 'react-i18next';
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

const PLACEMENT_OPTIONS_KEYS = ['placementHeader', 'placementFooter', 'placementInline'] as const;
const PLACEMENT_VALUES = ['header', 'footer', 'inline'] as const;
/** Backend LegalDisclaimerSpec channel enum: push, email, ads, whatsapp, inapp. Applies-to uses display labels. */
const APPLIES_TO_CHANNELS = [
  { value: 'Push', key: 'channelPush' },
  { value: 'Email', key: 'channelEmail' },
  { value: 'SMS', key: 'channelSms' },
  { value: 'WhatsApp', key: 'channelWhatsapp' },
  { value: 'In-app', key: 'channelInapp' },
  { value: 'Ads', key: 'channelAds' },
] as const;
const CHANNEL_OVERVIEW_VALUES = ['push', 'email', 'ads', 'whatsapp', 'inapp'] as const;
const CHANNEL_OVERVIEW_KEYS = ['channelPush', 'channelEmail', 'channelAds', 'channelWhatsapp', 'channelInapp'] as const;
const PRIMARY_LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'en-GB', label: 'English (GB)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
  { value: 'ta-IN', label: 'Tamil (India)' },
  { value: 'te-IN', label: 'Telugu (India)' },
];
const LOCALE_OPTIONS = ['en-US', 'en-GB', 'hi-IN', 'ta-IN', 'te-IN'];

export interface DisclaimerFormState {
  title?: string;
  channel?: string;
  locale?: string;
  text?: string;
  required?: boolean;
  placement?: string;
  channels?: string[];
  locales?: string[];
  translations?: Record<string, string>;
}

export interface DisclaimerDrawerContentProps {
  data: DisclaimerFormState;
  onDataChange: (data: DisclaimerFormState) => void;
  activeTab: string;
  /** When set, Audit tab filters events by this entity id (same wiring as P2 Audit view). */
  objectRef?: string;
}

function toggleArray(arr: string[] | undefined, value: string): string[] {
  const list = arr ?? [];
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function DisclaimerDrawerContent({ data, onDataChange, activeTab, objectRef }: DisclaimerDrawerContentProps) {
  const { t } = useTranslation('admin');
  const update = (field: keyof DisclaimerFormState, value: unknown) => {
    onDataChange({ ...data, [field]: value });
  };

  const channelOverviewOptions = CHANNEL_OVERVIEW_VALUES.map((val, i) => ({ value: val, label: t(`brand.drawer.disclaimer.${CHANNEL_OVERVIEW_KEYS[i]}`) }));
  const placementOptions = PLACEMENT_VALUES.map((val, i) => ({ value: val, label: t(`brand.drawer.disclaimer.${PLACEMENT_OPTIONS_KEYS[i]}`) }));

  if (activeTab === 'overview') {
    return (
      <div className="space-y-6">
        <FormField label={t('brand.drawer.disclaimer.title')} required help={t('brand.drawer.disclaimer.titleHelp')}>
          <input
            type="text"
            value={data.title ?? ''}
            onChange={(e) => update('title', e.target.value)}
            placeholder={t('brand.drawer.disclaimer.titlePlaceholder')}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d]"
          />
        </FormField>
        <FormField label={t('brand.drawer.disclaimer.disclaimerText')} required help={t('brand.drawer.disclaimer.disclaimerTextHelp')}>
          <textarea
            value={data.text ?? ''}
            onChange={(e) => update('text', e.target.value)}
            placeholder={t('brand.drawer.disclaimer.disclaimerTextPlaceholder')}
            className="w-full min-h-[120px] px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] resize-none"
          />
        </FormField>
        <FormField label={t('brand.drawer.disclaimer.primaryChannel')} required>
          <select
            value={data.channel ?? 'push'}
            onChange={(e) => update('channel', e.target.value)}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.drawer.disclaimer.primaryChannel')}
          >
            {channelOverviewOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('brand.drawer.disclaimer.primaryLocale')} required>
          <select
            value={data.locale ?? 'en-US'}
            onChange={(e) => update('locale', e.target.value)}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.drawer.disclaimer.primaryLocale')}
          >
            {PRIMARY_LOCALE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('brand.drawer.disclaimer.required')} help={t('brand.drawer.disclaimer.requiredHelp')}>
          <button
            type="button"
            role="switch"
            aria-checked={data.required ?? false}
            onClick={() => update('required', !(data.required ?? false))}
            className={`relative w-11 h-6 rounded-full transition-colors ${(data.required ?? false) ? 'bg-[#5e6ad2]' : 'bg-[#e5e5e5]'} cursor-pointer`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${(data.required ?? false) ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </FormField>
        <FormField label={t('brand.drawer.disclaimer.placementHint')}>
          <select
            value={data.placement ?? 'footer'}
            onChange={(e) => update('placement', e.target.value)}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.drawer.disclaimer.placementHint')}
          >
            {placementOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
      </div>
    );
  }

  if (activeTab === 'applies-to') {
    const channels = data.channels ?? [];
    const locales = data.locales ?? [];
    return (
      <div className="space-y-6">
        <div className="text-[13px] text-[#666]">
          {t('brand.drawer.disclaimer.appliesToIntro')}
        </div>
        <div className="space-y-2">
          {APPLIES_TO_CHANNELS.map(({ value, key }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(data.channels ?? []).includes(value)}
                onChange={() => update('channels', toggleArray(channels, value))}
                className="w-4 h-4 rounded border-[#e5e5e5]"
              />
              <span className="text-[13px] text-[#0d0d0d]">{t(`brand.drawer.disclaimer.${key}`)}</span>
            </label>
          ))}
        </div>
        <FormField label={t('brand.drawer.disclaimer.locales')} required help={t('brand.drawer.disclaimer.localesHelp')}>
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

  if (activeTab === 'localization') {
    const translations = data.translations ?? {};
    const locales = Object.keys(translations).length ? Object.keys(translations) : LOCALE_OPTIONS;
    return (
      <div className="space-y-4">
        <div className="text-[13px] text-[#666]">{t('brand.drawer.disclaimer.localizationIntro')}</div>
        {locales.map((locale) => (
          <FormField key={locale} label={t('brand.drawer.disclaimer.translationLabel', { locale })}>
            <textarea
              value={translations[locale] ?? ''}
              onChange={(e) => update('translations', { ...translations, [locale]: e.target.value })}
              placeholder={t('brand.drawer.disclaimer.translationPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] resize-none"
            />
          </FormField>
        ))}
      </div>
    );
  }

  if (activeTab === 'audit') {
    return (
      <DrawerAuditTab
        objectRefFilter={objectRef ? { resourceTypes: ['artifact'], entityId: objectRef } : undefined}
        description={t('brand.drawer.disclaimer.auditDescription')}
        emptyMessage={t('brand.drawer.disclaimer.auditEmpty')}
        enabled={true}
      />
    );
  }

  return <TabUnavailable />;
}
