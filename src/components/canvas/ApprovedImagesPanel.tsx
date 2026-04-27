'use client'

import { useMemo, useState } from 'react'
import { Search, Upload, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = ['Discover', 'My styles', 'Saved', 'Shared'] as const

interface ImageEntry {
  id: string
  name: string
  src: string
  category: string
  uploadedAt: string   // ISO date string
  deletable: boolean
}

const PRESET_IMAGES: ImageEntry[] = [
  { id: 'coffee-1', name: 'Coffee Product',  category: 'Preset', src: '/CoffeeInsta.png', uploadedAt: '2025-03-10T08:00:00Z', deletable: false },
  { id: 'coffee-2', name: 'Latte Table',     category: 'Preset', src: '/coffee.png',       uploadedAt: '2025-03-10T08:00:00Z', deletable: false },
  { id: 'coffee-3', name: 'Studio Portrait', category: 'Preset', src: '/CoffeeInsta.png',  uploadedAt: '2025-03-12T09:30:00Z', deletable: false },
  { id: 'coffee-4', name: 'Urban Mood',      category: 'Preset', src: '/coffee.png',       uploadedAt: '2025-03-14T11:00:00Z', deletable: false },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ApprovedImagesPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (src: string) => void
}

export const ApprovedImagesPanel: React.FC<ApprovedImagesPanelProps> = ({ open, onClose, onSelect }) => {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Discover')
  const [search, setSearch] = useState('')
  const [localUploads, setLocalUploads] = useState<ImageEntry[]>([])

  const images = useMemo(() => {
    const merged = [...localUploads, ...PRESET_IMAGES]
    const q = search.trim().toLowerCase()
    if (!q) return merged
    return merged.filter((img) => img.name.toLowerCase().includes(q) || img.category.toLowerCase().includes(q))
  }, [search, localUploads])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setLocalUploads((prev) => prev.filter((img) => img.id !== id))
  }

  if (!open) return null

  return (
    <div className="absolute inset-3 z-[70] rounded-xl border border-gray-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-4">
          {TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                'text-sm font-medium',
                tab === item ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
          <X size={16} />
        </button>
      </div>

      {/* Search + Upload */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <div className="inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500">
          <Search size={12} className="mr-1" />
          Search
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search approved images"
          className="h-8 flex-1 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-blue-300"
        />
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white">
          <Upload size={12} />
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                const src = String(reader.result ?? '')
                if (!src) return
                setLocalUploads((prev) => [
                  {
                    id: `upload-${Date.now()}`,
                    name: file.name,
                    src,
                    category: 'Uploaded',
                    uploadedAt: new Date().toISOString(),
                    deletable: true,
                  },
                  ...prev,
                ])
              }
              reader.readAsDataURL(file)
            }}
          />
        </label>
      </div>

      {/* Image grid */}
      <div className="h-[calc(100%-110px)] overflow-auto px-5 py-4">
        <h4 className="mb-3 text-xl font-semibold text-gray-900">Approved Images</h4>
        <div className="grid grid-cols-5 gap-3">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm">
              {/* Clickable image */}
              <button
                type="button"
                onClick={() => onSelect(image.src)}
                className="w-full text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.src} alt={image.name} className="h-24 w-full object-cover" />
                <div className="px-2 pt-2 pb-1">
                  <div className="truncate text-xs font-medium text-gray-800">{image.name}</div>
                  <div className="text-[10px] text-gray-400">{image.category}</div>
                </div>
              </button>

              {/* Date + delete row */}
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-[9px] text-gray-300">{formatDate(image.uploadedAt)}</span>
                {image.deletable && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(image.id, e)}
                    className="ml-auto rounded p-0.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Delete image"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
