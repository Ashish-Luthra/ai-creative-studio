'use client'

import { useMemo, useState } from 'react'
import { Search, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = ['Discover', 'My styles', 'Saved', 'Shared'] as const

const PRESET_IMAGES = [
  { id: 'coffee-1', name: 'Coffee Product', category: 'Photorealism', src: '/CoffeeInsta.png' },
  { id: 'coffee-2', name: 'Latte Table', category: 'Photorealism', src: '/coffee.png' },
  { id: 'coffee-3', name: 'Studio Portrait', category: 'Photorealism', src: '/CoffeeInsta.png' },
  { id: 'coffee-4', name: 'Urban Mood', category: 'Photorealism', src: '/coffee.png' },
]

interface ApprovedImagesPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (src: string) => void
}

export const ApprovedImagesPanel: React.FC<ApprovedImagesPanelProps> = ({ open, onClose, onSelect }) => {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Discover')
  const [search, setSearch] = useState('')
  const [localUploads, setLocalUploads] = useState<{ id: string; name: string; src: string; category: string }[]>([])

  const images = useMemo(() => {
    const merged = [...localUploads, ...PRESET_IMAGES]
    const q = search.trim().toLowerCase()
    if (!q) return merged
    return merged.filter((image) => image.name.toLowerCase().includes(q) || image.category.toLowerCase().includes(q))
  }, [search, localUploads])

  if (!open) return null

  return (
    <div className="absolute inset-3 z-[70] rounded-xl border border-gray-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-4">
          {TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                'text-sm font-medium',
                tab === item ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
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
                  { id: `upload-${Date.now()}`, name: file.name, src, category: 'Uploaded' },
                  ...prev,
                ])
              }
              reader.readAsDataURL(file)
            }}
          />
        </label>
      </div>

      <div className="h-[calc(100%-110px)] overflow-auto px-5 py-4">
        <h4 className="mb-3 text-xl font-semibold text-gray-900">Approved Images</h4>
        <div className="grid grid-cols-5 gap-3">
          {images.map((image) => (
            <button
              key={image.id}
              onClick={() => onSelect(image.src)}
              className="overflow-hidden rounded-lg border border-gray-200 text-left hover:border-blue-300 hover:shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.src} alt={image.name} className="h-24 w-full object-cover" />
              <div className="p-2">
                <div className="truncate text-xs font-medium text-gray-800">{image.name}</div>
                <div className="text-[10px] text-gray-500">{image.category}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
