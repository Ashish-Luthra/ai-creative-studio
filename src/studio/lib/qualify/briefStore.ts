import { create } from 'zustand';
import type { Vertical } from '../../../lib/vertical-detect';
// The .ts extension keeps this importable under node:test (strip-types
// resolves relative imports literally), matching the __tests__ convention.
import { QUALIFY_CATALOGUE_VERSION, getTask, getTasks, type QualifyQuestion } from './qualifyCatalogue.ts';

/**
 * The qualifying session.
 *
 * It lives in its own store rather than in `canvasStore` (which holds live
 * Fabric `Canvas`/`FabricObject` refs — non-serialisable, and every canvas
 * subscriber would re-render on each answer) and rather than in CanvasEditor
 * local state (navigating /studio/ads → /studio/email → back remounts
 * CanvasEditorClient and would wipe a half-answered flow).
 */

export type QualifyStatus = 'idle' | 'loading' | 'asking' | 'generating' | 'done' | 'error';

export interface StoryOption {
  id: string;
  label: string;
  hint: string;
  status: string;
}

export interface ChatMsg {
  from: 'user' | 'agent';
  body: string;
}

export interface QualifyAnswer {
  questionId: string;
  prompt: string;
  label: string;
  value: string;
  source: 'option' | 'freeText' | 'skipped';
  verbatim: boolean;
}

export interface BriefSession {
  schemaVersion: 1;
  sessionId: string;
  briefId: string;
  catalogueVersion: string;
  intent: string;
  status: QualifyStatus;
  domain: string | null;
  vertical: Vertical | null;
  verticalConfidence: number;
  verticalSource: 'brand-kit' | 'corpus' | 'default' | 'user';
  storyOptions: StoryOption[];
  taskId: string | null;
  /** 0 = vertical, 1 = task, 2.. = the task's questions. */
  index: number;
  answers: Record<string, QualifyAnswer>;
  error: string | null;
  /**
   * The full-screen brief becomes a right-hand dock once a first draft exists,
   * so the user can iterate against what they can see. The transcript is the
   * same session either way.
   */
  docked: boolean;
  /** Hidden for screen space; the session is kept and can be reopened. */
  dismissed: boolean;
  /** Retained across full-screen ⇄ docked and across reloads. */
  messages: ChatMsg[];
  /** What the user asked for, when they said. */
  assetType: string | null;
}

interface BriefStore {
  session: BriefSession | null;
  /**
   * An intent typed on the studio home page, waiting for CanvasEditor to feed
   * it through the real agent-submit path (asset check included). In-memory
   * only — a hard reload of /studio/ads must not replay it.
   */
  pendingIntent: string | null;
  setPendingIntent: (intent: string) => void;
  /** Atomic read-and-clear, so StrictMode's double mount consumes it once. */
  consumePendingIntent: () => string | null;
  start: (args: { briefId: string; intent: string }) => void;
  hydrate: (briefId: string) => void;
  setContext: (ctx: {
    domain: string | null;
    vertical: Vertical;
    confidence: number;
    source: 'brand-kit' | 'corpus' | 'default';
    storyOptions: StoryOption[];
  }) => void;
  chooseVertical: (vertical: Vertical) => void;
  chooseTask: (taskId: string) => void;
  answer: (answer: QualifyAnswer) => void;
  back: () => void;
  skipAll: () => void;
  setStatus: (status: QualifyStatus, error?: string | null) => void;
  dock: () => void;
  setDismissed: (dismissed: boolean) => void;
  addMessage: (msg: ChatMsg) => void;
  setAssetType: (asset: string | null) => void;
  reset: () => void;
}

const storageKey = (briefId: string) => `creative-canvas:${briefId}:brief-session`;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Steps before the task's own questions: vertical confirm, then task pick. */
export const PRELUDE_STEPS = 2;

/** The questions for the current session, with live options filled in. */
export function sessionQuestions(session: BriefSession | null): QualifyQuestion[] {
  if (!session?.vertical || !session.taskId) return [];
  const task = getTask(session.vertical, session.taskId);
  if (!task) return [];
  return task.questions
    .map((q) => {
      if (q.kind !== 'radio-live') return q;
      // Live options come from the corpus. With none available the question is
      // dropped from the run entirely rather than rendering an empty list.
      if (session.storyOptions.length === 0) return null;
      return {
        ...q,
        options: session.storyOptions.map((s) => ({
          id: s.id,
          label: s.label,
          value: s.label,
          hint: s.status === 'approved' ? s.hint : `${s.hint} · not approved yet`,
        })),
      };
    })
    .filter((q): q is QualifyQuestion => q !== null);
}

export function totalSteps(session: BriefSession | null): number {
  return PRELUDE_STEPS + sessionQuestions(session).length;
}

function persist(session: BriefSession | null) {
  if (typeof window === 'undefined' || !session) return;
  try {
    window.localStorage.setItem(storageKey(session.briefId), JSON.stringify(session));
  } catch {
    /* quota — the flow still works, it just won't survive a reload */
  }
}

export const useBriefStore = create<BriefStore>((set, get) => ({
  session: null,
  pendingIntent: null,

  setPendingIntent: (intent) => set({ pendingIntent: intent }),

  consumePendingIntent: () => {
    const intent = get().pendingIntent;
    if (intent) set({ pendingIntent: null });
    return intent;
  },

  start: ({ briefId, intent }) => {
    const session: BriefSession = {
      schemaVersion: 1,
      sessionId: newId(),
      briefId,
      catalogueVersion: QUALIFY_CATALOGUE_VERSION,
      intent,
      status: 'loading',
      domain: null,
      vertical: null,
      verticalConfidence: 0,
      verticalSource: 'default',
      storyOptions: [],
      taskId: null,
      index: 0,
      answers: {},
      error: null,
      docked: false,
      dismissed: false,
      messages: intent ? [{ from: 'user', body: intent }] : [],
      assetType: null,
    };
    set({ session });
    persist(session);
  },

  hydrate: (briefId) => {
    if (typeof window === 'undefined' || get().session) return;
    try {
      const raw = window.localStorage.getItem(storageKey(briefId));
      if (!raw) return;
      const stored = JSON.parse(raw) as BriefSession;
      // Discard rather than replay: question ids may have moved under it.
      // The version check alone doesn't catch session-shape drift from a dev
      // iteration that forgot to bump schemaVersion, so also check the shape.
      if (
        stored.schemaVersion !== 1 ||
        stored.catalogueVersion !== QUALIFY_CATALOGUE_VERSION ||
        !Array.isArray(stored.messages) ||
        typeof stored.answers !== 'object' || stored.answers === null
      ) {
        window.localStorage.removeItem(storageKey(briefId));
        return;
      }
      // A reload mid-generation would otherwise resume on a spinner that no
      // request is ever going to answer.
      const status: QualifyStatus =
        stored.status === 'generating' || stored.status === 'loading' ? 'asking' : stored.status;
      set({ session: { ...stored, status, error: null } });
    } catch {
      /* unreadable — start fresh */
    }
  },

  setContext: (ctx) => {
    const session = get().session;
    if (!session) return;
    const next: BriefSession = {
      ...session,
      domain: ctx.domain,
      // A user choice always outranks a later detection result.
      vertical: session.verticalSource === 'user' ? session.vertical : ctx.vertical,
      verticalConfidence: ctx.confidence,
      verticalSource: session.verticalSource === 'user' ? 'user' : ctx.source,
      storyOptions: ctx.storyOptions,
      status: session.status === 'loading' ? 'asking' : session.status,
    };
    set({ session: next });
    persist(next);
  },

  chooseVertical: (vertical) => {
    const session = get().session;
    if (!session) return;
    // Changing vertical invalidates the task and every task-scoped answer.
    const changed = session.vertical !== vertical;
    const next: BriefSession = {
      ...session,
      vertical,
      verticalSource: 'user',
      taskId: changed ? null : session.taskId,
      answers: changed ? {} : session.answers,
      index: 1,
      status: 'asking',
    };
    set({ session: next });
    persist(next);
  },

  chooseTask: (taskId) => {
    const session = get().session;
    if (!session) return;
    const changed = session.taskId !== taskId;
    const next: BriefSession = {
      ...session,
      taskId,
      answers: changed ? {} : session.answers,
      index: PRELUDE_STEPS,
      status: 'asking',
    };
    set({ session: next });
    persist(next);
  },

  answer: (answer) => {
    const session = get().session;
    if (!session) return;
    const next: BriefSession = {
      ...session,
      answers: { ...session.answers, [answer.questionId]: answer },
      index: session.index + 1,
    };
    set({ session: next });
    persist(next);
  },

  back: () => {
    const session = get().session;
    if (!session || session.index === 0) return;
    const next = { ...session, index: session.index - 1, status: 'asking' as const, error: null };
    set({ session: next });
    persist(next);
  },

  skipAll: () => {
    const session = get().session;
    if (!session) return;
    const next: BriefSession = { ...session, index: totalSteps(session) };
    set({ session: next });
    persist(next);
  },

  setStatus: (status, error = null) => {
    const session = get().session;
    if (!session) return;
    const next = { ...session, status, error };
    set({ session: next });
    persist(next);
  },

  dock: () => {
    const session = get().session;
    if (!session) return;
    const next = { ...session, docked: true, status: 'done' as const };
    set({ session: next });
    persist(next);
  },

  setDismissed: (dismissed) => {
    const session = get().session;
    if (!session) return;
    const next = { ...session, dismissed };
    set({ session: next });
    persist(next);
  },

  addMessage: (msg) => {
    const session = get().session;
    if (!session) return;
    const next = { ...session, messages: [...session.messages, msg].slice(-40) };
    set({ session: next });
    persist(next);
  },

  setAssetType: (assetType) => {
    const session = get().session;
    if (!session) return;
    const next = { ...session, assetType };
    set({ session: next });
    persist(next);
  },

  reset: () => {
    const session = get().session;
    if (session && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey(session.briefId));
      } catch {
        /* nothing to clean up */
      }
    }
    set({ session: null });
  },
}));

/** Task metadata for the current session, or null before one is chosen. */
export function sessionTask(session: BriefSession | null) {
  if (!session?.vertical || !session.taskId) return null;
  return getTask(session.vertical, session.taskId);
}

export function sessionTasks(session: BriefSession | null) {
  return session?.vertical ? getTasks(session.vertical) : [];
}
