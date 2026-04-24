'use client'

import { CREATIVE_PRESETS } from '@/lib/canvas/presets'
import { FolderKanban, Images, LayoutTemplate } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface ProjectsAssetsPanelProps {
  generatedPresetIds: string[]
  selectedPresetId: string
  onPresetOpen: (presetId: string) => void
  campaign: {
    briefId: string
    name: string
    updatedAt: string | null
    activePresetId: string
  }
  recentCampaigns: Array<{
    briefId: string
    name: string
    updatedAt: string | null
    activePresetId: string
  }>
  onCampaignRename: (nextName: string) => void
  onRecentCampaignOpen: (briefId: string, presetId: string) => void
}

export const ProjectsAssetsPanel: React.FC<ProjectsAssetsPanelProps> = ({
  generatedPresetIds,
  selectedPresetId,
  onPresetOpen,
  campaign,
  recentCampaigns,
  onCampaignRename,
  onRecentCampaignOpen,
}) => {
  const [view, setView] = useState<'campaigns' | 'saved' | 'templates'>('templates')
  const [draftName, setDraftName] = useState(campaign.name)
  const savedCount = generatedPresetIds.length
  const totalTemplates = CREATIVE_PRESETS.length

  const visiblePresets = useMemo(() => {
    if (view === 'saved') {
      return CREATIVE_PRESETS.filter((preset) => generatedPresetIds.includes(preset.id))
    }
    return CREATIVE_PRESETS
  }, [generatedPresetIds, view])

  useEffect(() => {
    setDraftName(campaign.name)
  }, [campaign.name])

  return (
    <aside className="absolute right-5 top-20 z-50 w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Projects / Assets</h3>
      <p className="mb-3 text-sm text-gray-600">Start page for campaigns, saved creatives, and templates.</p>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <SummaryCard
          icon={<FolderKanban size={13} />}
          title="Campaigns"
          value="1 active"
          active={view === 'campaigns'}
          onClick={() => setView('campaigns')}
        />
        <SummaryCard
          icon={<Images size={13} />}
          title="Saved"
          value={`${savedCount}`}
          active={view === 'saved'}
          onClick={() => setView('saved')}
        />
        <SummaryCard
          icon={<LayoutTemplate size={13} />}
          title="Templates"
          value={`${totalTemplates}`}
          active={view === 'templates'}
          onClick={() => setView('templates')}
        />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {view === 'campaigns' ? 'Campaign Drafts' : view === 'saved' ? 'Saved Creatives' : 'Templates'}
        </h4>
        <span className="text-[11px] text-gray-400">Gemini-style quick start</span>
      </div>

      {view === 'campaigns' && (
        <div className="mb-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Campaign name</div>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              const trimmed = draftName.trim()
              if (trimmed && trimmed !== campaign.name) onCampaignRename(trimmed)
              if (!trimmed) setDraftName(campaign.name)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const trimmed = draftName.trim()
                if (trimmed) onCampaignRename(trimmed)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm font-semibold text-blue-800 outline-none focus:border-blue-400"
          />
          <button
            onClick={() => onPresetOpen(campaign.activePresetId || selectedPresetId)}
            className="w-full rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white"
          >
            Resume latest draft ({campaign.activePresetId || selectedPresetId})
          </button>
          {campaign.updatedAt && (
            <div className="text-[11px] text-blue-500">Updated: {campaign.updatedAt}</div>
          )}
        </div>
      )}

      {view === 'campaigns' && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recent campaigns</div>
          <div className="space-y-1.5">
            {recentCampaigns
              .filter((item) => item.briefId !== campaign.briefId)
              .slice(0, 3)
              .map((item) => (
                <button
                  key={item.briefId}
                  onClick={() => onRecentCampaignOpen(item.briefId, item.activePresetId)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-left hover:bg-gray-50"
                >
                  <div className="truncate text-xs font-medium text-gray-800">{item.name}</div>
                  <div className="truncate text-[11px] text-gray-500">{item.briefId} • {item.updatedAt ?? 'No timestamp'}</div>
                </button>
              ))}
            {recentCampaigns.filter((item) => item.briefId !== campaign.briefId).length === 0 && (
              <div className="text-xs text-gray-500">No other campaigns yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {visiblePresets.map((preset) => {
          const generated = generatedPresetIds.includes(preset.id)
          const active = preset.id === selectedPresetId
          return (
            <button
              key={preset.id}
              onClick={() => onPresetOpen(preset.id)}
              className={`w-full rounded-md border px-3 py-2 text-left ${
                active ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{preset.label}</span>
                <span className={`text-[10px] ${generated ? 'text-green-600' : 'text-gray-400'}`}>
                  {generated ? 'saved' : 'new'}
                </span>
              </div>
              <div className="text-xs text-gray-500">{preset.width} x {preset.height}</div>
            </button>
          )
        })}
        {visiblePresets.length === 0 && (
          <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
            No saved creatives yet. Generate via Convert all or export from presets.
          </div>
        )}
      </div>
    </aside>
  )
}

const SummaryCard: React.FC<{ icon: React.ReactNode; title: string; value: string; active: boolean; onClick: () => void }> = ({
  icon,
  title,
  value,
  active,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`rounded-lg border px-2 py-2 text-left ${active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
  >
    <div className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-600">
      {icon}
    </div>
    <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{title}</div>
    <div className="text-xs font-semibold text-gray-800">{value}</div>
  </button>
)
