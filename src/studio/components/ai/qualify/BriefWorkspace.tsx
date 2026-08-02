'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { X, ChevronLeft, RotateCw, ArrowUp, Maximize2 } from 'lucide-react';
import { cn } from '@studio/lib/utils';
import { AllyvateIcon } from '../AllyvateAssistant';
import { VERTICAL_LABELS, VERTICALS, type Vertical } from '../../../../lib/vertical-detect';
import {
  PRELUDE_STEPS,
  sessionQuestions,
  sessionTask,
  sessionTasks,
  totalSteps,
  useBriefStore,
  type QualifyAnswer,
} from '@studio/lib/qualify/briefStore';
import { QualifyFreeTextRow, QualifyOptionRow, QualifyProgressDots, QualifyTaskPicker } from './QualifyCards';

/**
 * The brief conversation.
 *
 * One surface, two layouts. It opens FULL-SCREEN on a blank chat so a brief has
 * room to be written and the qualifying cards have room to be read; once a
 * first draft exists it docks to the right so the user can iterate against
 * what they can now see. The transcript and the session are the same object in
 * both — docking is a layout change, not a new conversation.
 */

export interface QualifyPayload {
  vertical: Vertical;
  taskId: string;
  taskName: string;
  presetId: string;
  ctaIntent: 'primary' | 'soft';
  answers: QualifyAnswer[];
  domain: string | null;
}

export function BriefWorkspace({
  onGenerate,
  onChat,
}: {
  onGenerate: (payload: QualifyPayload) => void;
  /** Free-form turn once a draft exists (refinement, or a different asset). */
  onChat: (text: string) => void;
}) {
  const session = useBriefStore((s) => s.session);
  const setContext = useBriefStore((s) => s.setContext);
  const chooseVertical = useBriefStore((s) => s.chooseVertical);
  const chooseTask = useBriefStore((s) => s.chooseTask);
  const answer = useBriefStore((s) => s.answer);
  const back = useBriefStore((s) => s.back);
  const skipAll = useBriefStore((s) => s.skipAll);
  const setStatus = useBriefStore((s) => s.setStatus);
  const setDismissed = useBriefStore((s) => s.setDismissed);

  const groupRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef<string | null>(null);
  const [draft, setDraft] = useState('');

  const docked = Boolean(session?.docked);

  // Detection + live story options: one call before the first card.
  useEffect(() => {
    if (!session || session.status !== 'loading') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/studio/brief/context');
        if (!res.ok) throw new Error('context');
        const body = await res.json();
        if (cancelled) return;
        setContext({
          domain: body.domain ?? null,
          vertical: body.vertical?.value ?? 'saas-tech',
          confidence: body.vertical?.confidence ?? 0,
          source: body.vertical?.source ?? 'default',
          storyOptions: body.storyOptions ?? [],
        });
      } catch {
        if (cancelled) return;
        // Detection is a convenience, never a gate.
        setContext({ domain: null, vertical: 'saas-tech', confidence: 0, source: 'default', storyOptions: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [session, setContext]);

  const questions = useMemo(() => sessionQuestions(session), [session]);
  const task = sessionTask(session);
  const tasks = sessionTasks(session);
  const total = totalSteps(session);
  const index = session?.index ?? 0;
  const busy = session?.status === 'generating';

  const submit = useCallback(() => {
    if (!session?.vertical || !task) return;
    const fireKey = `${session.sessionId}:${Object.keys(session.answers).length}`;
    if (firedRef.current === fireKey) return;
    firedRef.current = fireKey;
    setStatus('generating');
    onGenerate({
      vertical: session.vertical,
      taskId: task.id,
      taskName: task.name,
      presetId: task.defaultPresetId,
      ctaIntent: task.defaultCtaIntent,
      answers: questions.map(
        (q) =>
          session.answers[q.id] ?? {
            questionId: q.id, prompt: q.prompt, label: 'Skipped',
            value: '', source: 'skipped' as const, verbatim: false,
          }
      ),
      domain: session.domain,
    });
  }, [onGenerate, questions, session, setStatus, task]);

  // Past the last card → generate.
  useEffect(() => {
    if (!session || session.status !== 'asking' || session.docked) return;
    if (session.vertical && session.taskId && index >= total) submit();
  }, [index, session, submit, total]);

  // Focus the new card's first option so the number/arrow shortcuts work.
  useEffect(() => {
    if (session?.status !== 'asking' || docked) return;
    groupRef.current?.querySelector<HTMLElement>('[data-qualify-option]')?.focus({ preventScroll: true });
  }, [index, session?.status, session?.taskId, docked]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [session?.messages, busy]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(groupRef.current?.querySelectorAll<HTMLElement>('[data-qualify-option]') ?? []);
    if (options.length === 0) return;
    if (/^[1-9]$/.test(e.key)) {
      const target = options[Number(e.key) - 1];
      if (target) { e.preventDefault(); target.click(); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const active = options.findIndex((o) => o === document.activeElement);
      const next = e.key === 'ArrowDown'
        ? (active + 1 + options.length) % options.length
        : (active - 1 + options.length) % options.length;
      options[next]?.focus();
    }
  };

  const sendDraft = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    onChat(text);
  };

  if (!session || session.dismissed) return null;

  const currentQuestion = index >= PRELUDE_STEPS ? questions[index - PRELUDE_STEPS] : null;
  const asking = session.status === 'asking' && !session.docked;
  const detectionHelper =
    session.verticalSource === 'user' ? 'Your choice.'
      : session.verticalSource === 'brand-kit' ? 'Detected from your Brand Kit.'
      : session.verticalSource === 'corpus' ? 'Guessed from your content — change it if that looks wrong.'
      : 'Best guess — pick one.';

  // ── Transcript ─────────────────────────────────────────────────────────────
  const transcript = (
    <div className="flex flex-col gap-3">
      {session.messages.map((m, i) => (
        <div
          key={i}
          className={cn(
            'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
            m.from === 'user' ? 'ml-auto bg-[#1E1B4B] text-white' : 'bg-gray-100 text-gray-800'
          )}
        >
          {m.body}
        </div>
      ))}
      {busy && (
        <div className="flex items-center gap-1.5 rounded-2xl bg-gray-100 px-3.5 py-3">
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      )}
    </div>
  );

  // ── Cards ──────────────────────────────────────────────────────────────────
  const cards = asking && (
    <div ref={groupRef} onKeyDown={onKeyDown} className="rounded-2xl border border-gray-200 bg-white p-4">
      {index === 0 && (
        <Card prompt="Just to confirm — what kind of business is this?" helper={detectionHelper}>
          <div role="radiogroup" aria-label="Sector" className="flex flex-col gap-2">
            {VERTICALS.map((v, i) => (
              <QualifyOptionRow
                key={v} index={i}
                option={{ id: v, label: VERTICAL_LABELS[v], value: v }}
                selected={session.vertical === v}
                onSelect={() => chooseVertical(v)}
              />
            ))}
          </div>
        </Card>
      )}

      {index === 1 && (
        <Card prompt="What are you running?" helper="Each one asks different questions from here.">
          <QualifyTaskPicker tasks={tasks} selectedId={session.taskId} onSelect={chooseTask} />
        </Card>
      )}

      {currentQuestion && (
        <Card prompt={currentQuestion.prompt} helper={currentQuestion.helper}>
          <div role="radiogroup" aria-label={currentQuestion.prompt} className="flex flex-col gap-2">
            {currentQuestion.options.map((o, i) => (
              <QualifyOptionRow
                key={o.id} index={i} option={o}
                selected={session.answers[currentQuestion.id]?.value === o.value}
                onSelect={() =>
                  answer({
                    questionId: currentQuestion.id, prompt: currentQuestion.prompt,
                    label: o.label, value: o.value, source: 'option', verbatim: false,
                  })
                }
              />
            ))}
            {currentQuestion.freeText !== 'off' && (
              <QualifyFreeTextRow
                required={currentQuestion.freeText === 'required'}
                placeholder={currentQuestion.verbatim ? 'Type it exactly as it should appear…' : 'Write your own answer…'}
                onSubmit={(text) =>
                  answer({
                    questionId: currentQuestion.id, prompt: currentQuestion.prompt,
                    label: text, value: text, source: 'freeText',
                    verbatim: Boolean(currentQuestion.verbatim),
                  })
                }
              />
            )}
          </div>
        </Card>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-3">
          <QualifyProgressDots total={total} index={Math.min(index, total - 1)} onJump={() => back()} />
          {index > 0 && (
            <button onClick={back} className="flex items-center gap-0.5 text-[11.5px] text-gray-400 hover:text-gray-700">
              <ChevronLeft size={12} /> Back
            </button>
          )}
        </div>
        {index >= 1 && session.taskId && (
          <button onClick={skipAll} className="rounded-lg px-2.5 py-1.5 text-[12px] text-gray-500 hover:bg-gray-50 hover:text-gray-800">
            Skip the rest
          </button>
        )}
      </div>
    </div>
  );

  const errorBlock = session.status === 'error' && (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white py-6">
      <p className="px-4 text-center text-[12.5px] text-gray-600">{session.error ?? 'That didn’t work.'}</p>
      <button
        onClick={() => { firedRef.current = null; setStatus('asking'); }}
        className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-gray-700"
      >
        <RotateCw size={12} /> Try again
      </button>
    </div>
  );

  const composer = (
    <div className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-3 py-2 focus-within:border-gray-900">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendDraft(); } e.stopPropagation(); }}
        disabled={busy}
        placeholder={docked ? 'Ask for a change…' : 'Add anything else about this brief…'}
        className="flex-1 bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
      />
      <button
        onClick={sendDraft}
        disabled={busy || !draft.trim()}
        aria-label="Send"
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
          draft.trim() && !busy ? 'bg-gray-900 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-400'
        )}
      >
        <ArrowUp size={13} />
      </button>
    </div>
  );

  const header = (
    <div className="flex items-center gap-2.5">
      <AllyvateIcon size={18} />
      <span className="flex-1 text-[13px] font-semibold text-gray-900">Creative brief</span>
      {docked && (
        <button
          onClick={() => useBriefStore.setState((s) => (s.session ? { session: { ...s.session, docked: false } } : s))}
          aria-label="Expand"
          title="Expand"
          className="rounded-md p-1 text-gray-300 hover:bg-gray-50 hover:text-gray-600"
        >
          <Maximize2 size={13} />
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Close"
        title="Hide — your conversation is kept"
        className="rounded-md p-1 text-gray-300 hover:bg-gray-50 hover:text-gray-600"
      >
        <X size={15} />
      </button>
    </div>
  );

  // ── Docked: right-hand rail for iterating on a visible draft ───────────────
  if (docked) {
    return (
      <div className="absolute right-5 top-20 z-[95] flex max-h-[70vh] w-80 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
        {header}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">{transcript}</div>
        {composer}
      </div>
    );
  }

  // ── Full screen: a blank chat with room to think ───────────────────────────
  return (
    <div className="absolute inset-0 z-[110] flex flex-col bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-6 py-3.5">{header}</div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-[640px] max-w-[calc(100%-48px)] flex-col gap-4 py-8">
          {session.messages.length === 0 && !asking && (
            <p className="py-10 text-center text-[13px] text-gray-400">
              Describe what you want to make — an ad, a landing page, a case study.
            </p>
          )}
          {transcript}
          {session.status === 'loading' && (
            <p className="py-4 text-center text-[12.5px] text-gray-400">Reading your Brand Kit…</p>
          )}
          {cards}
          {errorBlock}
        </div>
      </div>

      <div className="border-t border-gray-100 px-6 py-4">
        <div className="mx-auto w-[640px] max-w-[calc(100%-48px)]">{composer}</div>
      </div>
    </div>
  );
}

function Card({ prompt, helper, children }: { prompt: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-[14px] font-semibold text-gray-900">{prompt}</h3>
        {helper && <p className="mt-0.5 text-[11.5px] text-gray-500">{helper}</p>}
      </div>
      {children}
    </div>
  );
}
