'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Check, Pencil } from 'lucide-react';
import { cn } from '@studio/lib/utils';
import type { QualifyOption, QualifyTask } from '@studio/lib/qualify/qualifyCatalogue';

/**
 * Card primitives for the qualifying flow.
 *
 * Hand-rolled radio semantics: the ported @martechos/ui subset has no
 * Radio/RadioGroup/Select/Chip, and pulling in a headless-UI dependency for one
 * card isn't worth the justification a new dep requires.
 */

// ── Option row ───────────────────────────────────────────────────────────────

export function QualifyOptionRow({
  option,
  index,
  selected,
  disabled,
  onSelect,
}: {
  option: QualifyOption;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      // Roving tabindex: the group is one tab stop, arrows move within it.
      tabIndex={selected ? 0 : -1}
      data-qualify-option={index}
      onClick={onSelect}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15',
        selected
          ? 'border-gray-900 bg-gray-50'
          : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50/60',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span
        className={cn(
          'mt-[3px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white'
        )}
        aria-hidden="true"
      >
        {selected && <Check size={10} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-snug text-gray-900">{option.label}</span>
        {option.hint && <span className="mt-0.5 block text-[11.5px] leading-snug text-gray-500">{option.hint}</span>}
      </span>
      <span className="mt-[2px] shrink-0 font-mono text-[10px] text-gray-300 group-hover:text-gray-400">
        {index + 1}
      </span>
    </button>
  );
}

// ── Free-text row ────────────────────────────────────────────────────────────

export function QualifyFreeTextRow({
  required,
  placeholder,
  disabled,
  onSubmit,
}: {
  required: boolean;
  placeholder?: string;
  disabled?: boolean;
  onSubmit: (text: string) => void;
}) {
  // Draft stays local — putting keystrokes in the global store would re-render
  // the whole canvas tree on every character.
  const [open, setOpen] = useState(required);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    // Number keys are option shortcuts at the card level; stop them here so
    // typing "14 days" doesn't select option 1 and jump to the next question.
    e.stopPropagation();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        disabled={disabled}
        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-gray-200 px-3.5 py-2.5 text-left text-[13px] text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
      >
        <Pencil size={12} />
        Write your own answer…
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 focus-within:border-gray-900">
      <Pencil size={12} className="shrink-0 text-gray-400" />
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Write your own answer…'}
        className="flex-1 bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
      />
      <button
        type="button"
        onClick={commit}
        disabled={disabled || !draft.trim()}
        className={cn(
          'shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors',
          draft.trim() ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400'
        )}
      >
        Use this
      </button>
    </div>
  );
}

// ── Progress dots ────────────────────────────────────────────────────────────

export function QualifyProgressDots({
  total,
  index,
  onJump,
}: {
  total: number;
  index: number;
  onJump: (step: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          // Only answered steps are navigable — jumping ahead would skip the
          // answers the later questions depend on.
          onClick={() => i < index && onJump(i)}
          disabled={i > index}
          aria-label={`Step ${i + 1}`}
          aria-current={i === index ? 'step' : undefined}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i === index ? 'w-5 bg-gray-900' : 'w-1.5',
            i < index ? 'cursor-pointer bg-gray-400 hover:bg-gray-600' : i > index ? 'bg-gray-200' : ''
          )}
        />
      ))}
    </div>
  );
}

// ── Task picker ──────────────────────────────────────────────────────────────

const CATEGORY_TONE: Record<string, string> = {
  Acquisition: 'bg-blue-50 text-blue-700',
  Conversion: 'bg-violet-50 text-violet-700',
  Promotion: 'bg-amber-50 text-amber-700',
  Launch: 'bg-emerald-50 text-emerald-700',
  Consideration: 'bg-teal-50 text-teal-700',
  Retention: 'bg-orange-50 text-orange-700',
  Trust: 'bg-sky-50 text-sky-700',
  Awareness: 'bg-indigo-50 text-indigo-700',
  Growth: 'bg-green-50 text-green-700',
  Proof: 'bg-pink-50 text-pink-700',
  'Lead gen': 'bg-fuchsia-50 text-fuchsia-700',
};

export function QualifyTaskPicker({
  tasks,
  selectedId,
  disabled,
  onSelect,
}: {
  tasks: QualifyTask[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (taskId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Campaign type">
      {tasks.map((task, i) => {
        const selected = task.id === selectedId;
        return (
          <button
            key={task.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : i === 0 && !selectedId ? 0 : -1}
            data-qualify-option={i}
            disabled={disabled}
            onClick={() => onSelect(task.id)}
            className={cn(
              'flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15',
              selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-400',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <span
              className={cn(
                'w-fit rounded-full px-2 py-0.5 text-[10.5px] font-medium',
                CATEGORY_TONE[task.category] ?? 'bg-gray-100 text-gray-600'
              )}
            >
              {task.category}
            </span>
            <span className="text-[13px] font-semibold leading-snug text-gray-900">{task.name}</span>
            <span className="text-[11.5px] leading-snug text-gray-500">{task.description}</span>
          </button>
        );
      })}
    </div>
  );
}
