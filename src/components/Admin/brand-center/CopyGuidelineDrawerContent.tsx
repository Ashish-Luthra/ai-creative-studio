/**
 * Copy Guideline drawer content — Figma Make CopyGuidelineDrawerContent.
 * Tabs: Overview, Forbidden Terms, Tone Rules, Examples, Audit.
 */
import { useState } from 'react';
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

const CATEGORY_OPTIONS_IDS = ['tone', 'forbidden-terms', 'required-phrases', 'formatting'] as const;
const CATEGORY_KEYS = ['categoryTone', 'categoryForbidden', 'categoryRequired', 'categoryFormatting'] as const;
const SEVERITY_OPTIONS_IDS = ['critical', 'high', 'medium', 'low'] as const;
const SEVERITY_KEYS = ['severityCritical', 'severityHigh', 'severityMedium', 'severityLow'] as const;

type ForbiddenTerm = { term: string; severity: string; reason: string };

function ForbiddenTermsTab({
  terms,
  onTermsChange,
  severityOptions,
}: {
  terms: ForbiddenTerm[];
  onTermsChange: (next: ForbiddenTerm[]) => void;
  severityOptions: { value: string; label: string }[];
}) {
  const { t } = useTranslation('admin');
  const [newTerm, setNewTerm] = useState('');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [newReason, setNewReason] = useState('');
  const handleAdd = () => {
    const val = (newTerm ?? '').trim();
    if (!val) return;
    onTermsChange([...terms, { term: val, severity: newSeverity, reason: (newReason ?? '').trim() }]);
    setNewTerm('');
    setNewSeverity('medium');
    setNewReason('');
  };
  const handleRemove = (index: number) => {
    onTermsChange(terms.filter((_, i) => i !== index));
  };
  return (
    <div className="space-y-4">
      <div className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.drawer.copyGuideline.forbiddenTermsList')}</div>
      {terms.length === 0 ? (
        <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center text-[13px] text-[#666]">{t('brand.drawer.copyGuideline.noTermsYet')}</div>
      ) : (
        terms.map((term, index) => (
          <div key={index} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[13px] font-medium text-[#0d0d0d]">{term.term}</span>
                <span className={`px-2 h-5 rounded text-[11px] font-medium shrink-0 ${term.severity === 'critical' ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#fef3c7] text-[#92400e]'}`}>
                  {term.severity}
                </span>
              </div>
              {term.reason && <div className="text-[12px] text-[#666]">{term.reason}</div>}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="shrink-0 p-1 rounded text-[#666] hover:bg-[#e5e5e5] hover:text-[#0d0d0d] text-[12px]"
              aria-label={t('brand.drawer.copyGuideline.removeTermAria', { term: term.term })}
            >
              {t('brand.drawer.copyGuideline.remove')}
            </button>
          </div>
        ))
      )}
      <div className="pt-2 border-t border-[#e5e5e5] space-y-3">
        <div className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.drawer.copyGuideline.addTerm')}</div>
        <div className="grid grid-cols-1 gap-3">
          <Input
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder={t('brand.drawer.copyGuideline.termPlaceholder')}
            className="text-sm h-9"
            aria-label={t('brand.drawer.copyGuideline.addTerm')}
          />
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value)}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.drawer.copyGuideline.severity')}
          >
            {severityOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <textarea
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder={t('brand.drawer.copyGuideline.reasonPlaceholder')}
            rows={2}
            className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] resize-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!(newTerm ?? '').trim()}
            className="h-9 px-4 rounded-md bg-[#0d0d0d] text-white text-[13px] font-medium hover:bg-[#262626] disabled:opacity-50 disabled:pointer-events-none"
          >
            {t('brand.drawer.copyGuideline.addTermButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToneRulesTab({
  dos,
  donts,
  onChange,
}: {
  dos: string[];
  donts: string[];
  onChange: (dos: string[], donts: string[]) => void;
}) {
  const { t } = useTranslation('admin');
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');
  const handleAddDo = () => {
    const v = (newDo ?? '').trim();
    if (!v) return;
    onChange([...dos, v], donts);
    setNewDo('');
  };
  const handleAddDont = () => {
    const v = (newDont ?? '').trim();
    if (!v) return;
    onChange(dos, [...donts, v]);
    setNewDont('');
  };
  const removeDo = (i: number) => onChange(dos.filter((_, idx) => idx !== i), donts);
  const removeDont = (i: number) => onChange(dos, donts.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] font-medium text-[#0d0d0d] mb-2">{t('brand.drawer.copyGuideline.dos')}</div>
        {dos.length === 0 ? (
          <div className="text-[13px] text-[#666]">{t('brand.drawer.copyGuideline.noneDefinedAddBelow')}</div>
        ) : (
          dos.map((item, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <span className="text-[13px] text-[#10b981]">✓ {item}</span>
              <button type="button" onClick={() => removeDo(i)} className="text-[12px] text-[#666] hover:text-[#dc2626]">{t('brand.drawer.copyGuideline.remove')}</button>
            </div>
          ))
        )}
        <div className="flex gap-2 mt-2">
          <Input value={newDo} onChange={(e) => setNewDo(e.target.value)} placeholder={t('brand.drawer.copyGuideline.addDoPlaceholder')} className="text-sm h-9 flex-1" aria-label={t('brand.drawer.copyGuideline.addDoPlaceholder')} />
          <button type="button" onClick={handleAddDo} disabled={!(newDo ?? '').trim()} className="h-9 px-4 rounded-md bg-[#0d0d0d] text-white text-[13px] font-medium hover:bg-[#262626] disabled:opacity-50 disabled:pointer-events-none">{t('brand.drawer.copyGuideline.addButton')}</button>
        </div>
      </div>
      <div>
        <div className="text-[13px] font-medium text-[#0d0d0d] mb-2">{t('brand.drawer.copyGuideline.donts')}</div>
        {donts.length === 0 ? (
          <div className="text-[13px] text-[#666]">{t('brand.drawer.copyGuideline.noneDefinedAddBelow')}</div>
        ) : (
          donts.map((item, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <span className="text-[13px] text-[#dc2626]">✗ {item}</span>
              <button type="button" onClick={() => removeDont(i)} className="text-[12px] text-[#666] hover:text-[#dc2626]">{t('brand.drawer.copyGuideline.remove')}</button>
            </div>
          ))
        )}
        <div className="flex gap-2 mt-2">
          <Input value={newDont} onChange={(e) => setNewDont(e.target.value)} placeholder={t('brand.drawer.copyGuideline.addDontPlaceholder')} className="text-sm h-9 flex-1" aria-label={t('brand.drawer.copyGuideline.addDontPlaceholder')} />
          <button type="button" onClick={handleAddDont} disabled={!(newDont ?? '').trim()} className="h-9 px-4 rounded-md bg-[#0d0d0d] text-white text-[13px] font-medium hover:bg-[#262626] disabled:opacity-50 disabled:pointer-events-none">{t('brand.drawer.copyGuideline.addButton')}</button>
        </div>
      </div>
    </div>
  );
}

function ExamplesTab({
  examples,
  onChange,
}: {
  examples: { good: string; bad: string }[];
  onChange: (next: { good: string; bad: string }[]) => void;
}) {
  const { t } = useTranslation('admin');
  const [newGood, setNewGood] = useState('');
  const [newBad, setNewBad] = useState('');
  const handleAdd = () => {
    const g = (newGood ?? '').trim();
    const b = (newBad ?? '').trim();
    if (!g && !b) return;
    onChange([...examples, { good: g, bad: b }]);
    setNewGood('');
    setNewBad('');
  };
  const handleRemove = (index: number) => {
    onChange(examples.filter((_, i) => i !== index));
  };
  return (
    <div className="space-y-4">
      <div className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.drawer.copyGuideline.goodVsBadExamples')}</div>
      {examples.length === 0 ? (
        <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-md p-4 text-center text-[13px] text-[#666]">{t('brand.drawer.copyGuideline.noExamplesYet')}</div>
      ) : (
        examples.map((example, index) => (
          <div key={index} className="space-y-3 p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-md">
            <div className="p-3 bg-[#d1fae5] border border-[#a7f3d0] rounded-md">
              <div className="text-[11px] font-medium text-[#065f46] uppercase mb-1">{t('brand.drawer.copyGuideline.goodLabel')}</div>
              <div className="text-[13px] text-[#0d0d0d]">{example.good || '—'}</div>
            </div>
            <div className="p-3 bg-[#fee2e2] border border-[#fecaca] rounded-md">
              <div className="text-[11px] font-medium text-[#991b1b] uppercase mb-1">{t('brand.drawer.copyGuideline.badLabel')}</div>
              <div className="text-[13px] text-[#0d0d0d]">{example.bad || '—'}</div>
            </div>
            <button type="button" onClick={() => handleRemove(index)} className="text-[12px] text-[#666] hover:text-[#dc2626]">{t('brand.drawer.copyGuideline.removeExample')}</button>
          </div>
        ))
      )}
      <div className="pt-2 border-t border-[#e5e5e5] space-y-3">
        <div className="text-[13px] font-medium text-[#0d0d0d]">{t('brand.drawer.copyGuideline.addExample')}</div>
        <div className="grid grid-cols-1 gap-3">
          <textarea value={newGood} onChange={(e) => setNewGood(e.target.value)} placeholder={t('brand.drawer.copyGuideline.goodExamplePlaceholder')} rows={2} className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] resize-none" />
          <textarea value={newBad} onChange={(e) => setNewBad(e.target.value)} placeholder={t('brand.drawer.copyGuideline.badExamplePlaceholder')} rows={2} className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] resize-none" />
          <button type="button" onClick={handleAdd} disabled={!(newGood ?? '').trim() && !(newBad ?? '').trim()} className="h-9 px-4 rounded-md bg-[#0d0d0d] text-white text-[13px] font-medium hover:bg-[#262626] disabled:opacity-50 disabled:pointer-events-none">{t('brand.drawer.copyGuideline.addExampleButton')}</button>
        </div>
      </div>
    </div>
  );
}

export interface CopyGuidelineFormState {
  name?: string;
  category?: string;
  severity?: string;
  description?: string;
  forbiddenTerms?: { term: string; severity: string; reason: string }[];
  toneRules?: { dos?: string[]; donts?: string[] };
  examples?: { good: string; bad: string }[];
}

export interface CopyGuidelineDrawerContentProps {
  data: CopyGuidelineFormState;
  onDataChange: (data: CopyGuidelineFormState) => void;
  activeTab: string;
  /** When set, Audit tab filters events by this entity id (same wiring as P2 Audit view). */
  objectRef?: string;
}

export function CopyGuidelineDrawerContent({ data, onDataChange, activeTab, objectRef }: CopyGuidelineDrawerContentProps) {
  const { t } = useTranslation('admin');
  const update = (field: keyof CopyGuidelineFormState, value: unknown) => {
    onDataChange({ ...data, [field]: value });
  };

  const categoryOptions = CATEGORY_OPTIONS_IDS.map((id, i) => ({ value: id, label: t(`brand.drawer.copyGuideline.${CATEGORY_KEYS[i]}`) }));
  const severityOptions = SEVERITY_OPTIONS_IDS.map((id, i) => ({ value: id, label: t(`brand.drawer.copyGuideline.${SEVERITY_KEYS[i]}`) }));

  if (activeTab === 'overview') {
    return (
      <div className="space-y-6">
        <FormField label={t('brand.drawer.copyGuideline.guidelineName')} required>
          <Input
            value={data.name ?? ''}
            onChange={(e) => update('name', e.target.value)}
            placeholder={t('brand.drawer.copyGuideline.guidelineNamePlaceholder')}
            className="text-sm h-9"
            aria-label={t('brand.drawer.copyGuideline.guidelineName')}
          />
        </FormField>
        <FormField label={t('brand.drawer.copyGuideline.category')} required help={t('brand.drawer.copyGuideline.categoryHelp')}>
          <select
            value={data.category ?? ''}
            onChange={(e) => update('category', e.target.value)}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.drawer.copyGuideline.category')}
          >
            <option value="">{t('brand.drawer.copyGuideline.selectCategory')}</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('brand.drawer.copyGuideline.severity')} required help={t('brand.drawer.copyGuideline.severityHelp')}>
          <select
            value={data.severity ?? ''}
            onChange={(e) => update('severity', e.target.value)}
            className="w-full h-9 px-3 bg-white border border-[#e5e5e5] rounded-md text-[13px] focus:outline-none focus:border-[#0d0d0d]"
            aria-label={t('brand.drawer.copyGuideline.severity')}
          >
            <option value="">{t('brand.drawer.copyGuideline.selectSeverity')}</option>
            {severityOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('brand.drawer.copyGuideline.description')}>
          <textarea
            value={data.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            placeholder={t('brand.drawer.copyGuideline.descriptionPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 bg-white border border-[#e5e5e5] rounded-md text-[13px] placeholder:text-[#999] focus:outline-none focus:border-[#0d0d0d] resize-none"
          />
        </FormField>
      </div>
    );
  }

  if (activeTab === 'forbidden-terms') {
    const terms = data.forbiddenTerms ?? [];
    return (
      <ForbiddenTermsTab
        terms={terms}
        onTermsChange={(next) => update('forbiddenTerms', next)}
        severityOptions={severityOptions}
      />
    );
  }

  if (activeTab === 'tone-rules') {
    const dos = data.toneRules?.dos ?? [];
    const donts = data.toneRules?.donts ?? [];
    return (
      <ToneRulesTab
        dos={dos}
        donts={donts}
        onChange={(nextDos, nextDonts) => update('toneRules', { dos: nextDos, donts: nextDonts })}
      />
    );
  }

  if (activeTab === 'examples') {
    const examples = data.examples ?? [];
    return (
      <ExamplesTab
        examples={examples}
        onChange={(next) => update('examples', next)}
      />
    );
  }

  if (activeTab === 'audit') {
    return (
      <DrawerAuditTab
        objectRefFilter={objectRef ? { resourceTypes: ['artifact'], entityId: objectRef } : undefined}
        description={t('brand.drawer.copyGuideline.auditDescription')}
        emptyMessage={t('brand.drawer.copyGuideline.auditEmpty')}
        enabled={true}
      />
    );
  }

  return <TabUnavailable />;
}
