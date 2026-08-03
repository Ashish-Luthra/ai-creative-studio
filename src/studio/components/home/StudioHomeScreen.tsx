'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpenText,
  ChartLine,
  ChevronRight,
  FileText,
  LayoutPanelLeft,
  Mail,
  Megaphone,
  PanelsTopLeft,
  RadioTower,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useBriefStore } from '@studio/lib/qualify/briefStore'
import { useEmailStore } from '@studio/lib/email/emailStore'
import { CAPABILITIES } from '@studio/lib/home/capabilities'
import {
  formatRelativeTime,
  mergeRecentWork,
  type RecentCampaignLike,
  type RecentEmailerLike,
  type RecentWorkItem,
} from '@studio/lib/home/recentWork'
import { HomePromptBox, type PromptChip } from './HomePromptBox'
import { CapabilityCard } from './CapabilityCard'

/** Written by CanvasEditor; newest first, capped at 8. */
const RECENT_CAMPAIGNS_KEY = 'creative-canvas:recent-campaigns'

/** Icons stay out of capabilities.ts so it remains importable under node:test. */
const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  'landing-page': PanelsTopLeft,
  'case-study': BookOpenText,
  'social-ads': Megaphone,
  personalisation: UserRound,
  performance: ChartLine,
  'own-media': RadioTower,
}

const RECENT_KIND_ICONS: Record<RecentWorkItem['kind'], LucideIcon> = {
  campaign: LayoutPanelLeft,
  emailer: Mail,
}

export const StudioHomeScreen: React.FC = () => {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [recent, setRecent] = useState<RecentWorkItem[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false

    let campaigns: RecentCampaignLike[] = []
    try {
      const raw = window.localStorage.getItem(RECENT_CAMPAIGNS_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) campaigns = parsed as RecentCampaignLike[]
    } catch {
      /* unreadable — show emailers only */
    }
    setRecent(mergeRecentWork(campaigns, []))

    void fetch('/api/studio/emailers')
      .then((res) => (res.ok ? (res.json() as Promise<RecentEmailerLike[]>) : []))
      .then((emailers) => {
        if (!cancelled && Array.isArray(emailers)) {
          setRecent(mergeRecentWork(campaigns, emailers))
        }
      })
      .catch(() => {
        /* stub down — the campaign rows already rendered */
      })

    return () => {
      cancelled = true
    }
  }, [])

  const seedPrompt = (text: string) => {
    setValue(text)
    const el = textareaRef.current
    if (!el) return
    // Focus now (rAF is throttled in occluded panes and may never fire); the
    // caret waits a tick for React to flush the seeded value into the DOM.
    el.focus()
    setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0)
  }

  const handleSubmit = (text: string) => {
    // CanvasEditor consumes this on mount and runs the real submit path —
    // asset check included — so a page/email intent routes on from there.
    useBriefStore.getState().setPendingIntent(text)
    router.push('/studio/ads')
  }

  const openRecent = (item: RecentWorkItem) => {
    if (item.kind === 'emailer') {
      useEmailStore.getState().requestOpenEmailer(item.id.replace(/^emailer:/, ''))
      router.push('/studio/email')
      return
    }
    // briefId is 'dev-session' everywhere, so the canvas restores itself.
    router.push('/studio/ads')
  }

  const chips: PromptChip[] = [
    { id: 'ad', label: 'Ad', icon: Megaphone, onClick: () => seedPrompt('Create an ad for ') },
    { id: 'landing-page', label: 'Landing page', icon: FileText, onClick: () => seedPrompt('Create a landing page for ') },
    { id: 'case-study', label: 'Case study', icon: BarChart3, onClick: () => seedPrompt('Create a case study for ') },
    { id: 'email', label: 'Email', icon: Mail, onClick: () => seedPrompt('Create an email for ') },
  ]

  const now = Date.now()

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-4xl px-8 py-16">
        <h1 className="text-center text-[26px] font-semibold text-gray-900">
          What would you like to create today?
        </h1>
        <p className="mt-2 text-center text-[13px] text-gray-500">
          Ask the agent — or pick up where you left off.
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <HomePromptBox
            value={value}
            onValueChange={setValue}
            onSubmit={handleSubmit}
            chips={chips}
            textareaRef={textareaRef}
          />
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <div className="text-[13px] font-semibold text-gray-900">Recent work</div>
          {recent.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-[13px] text-gray-400">
              Nothing here yet — recent campaigns and saved emails will show up here.
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {recent.map((item) => {
                const KindIcon = RECENT_KIND_ICONS[item.kind]
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openRecent(item)}
                    className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-gray-300"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                      <KindIcon size={15} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-900">
                      {item.name}
                    </span>
                    <span className="shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-500">
                      {item.surfaceLabel}
                    </span>
                    <span className="shrink-0 text-[12px] text-gray-400">
                      {formatRelativeTime(item.ts, now)}
                    </span>
                    <ChevronRight
                      size={14}
                      className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <CapabilityCard
              key={cap.id}
              title={cap.title}
              description={cap.description}
              icon={CAPABILITY_ICONS[cap.id] ?? PanelsTopLeft}
              illustrationSrc={cap.illustration}
              onClick={() => seedPrompt(cap.seedPrompt)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
