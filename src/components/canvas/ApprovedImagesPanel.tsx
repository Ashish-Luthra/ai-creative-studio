'use client'

import { useMemo, useState, useEffect } from 'react'
import { Search, Upload, X, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Categories ───────────────────────────────────────────────────────────────

export const IMAGE_CATEGORIES = [
  'Logo & Brand Marks',
  'Product Images',
  'Lifestyle & Campaign',
  'Backgrounds & Textures',
  'Icons & UI Elements',
  'Social Media Assets',
  'AI Generated',
  'Illustrations & Graphics',
  'Uncategorised',
] as const

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number]

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageEntry {
  id: string
  name: string
  src: string
  category: ImageCategory
  uploadedAt: string
  deletable: boolean
}

const STORAGE_KEY = 'ai-creative-studio:image-library'

function loadFromStorage(): ImageEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ImageEntry[]
  } catch {
    return []
  }
}

function saveToStorage(entries: ImageEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ApprovedImagesPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (src: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ApprovedImagesPanel: React.FC<ApprovedImagesPanelProps> = ({ open, onClose, onSelect }) => {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<ImageCategory | 'All'>('All')
  const [uploadCategory, setUploadCategory] = useState<ImageCategory>('Uncategorised')
  const [showUploadCategoryMenu, setShowUploadCategoryMenu] = useState(false)
  const [uploads, setUploads] = useState<ImageEntry[]>([])

  // Load from localStorage on first mount
  useEffect(() => {
    setUploads(loadFromStorage())
  }, [])

  // Persist to localStorage whenever uploads change
  useEffect(() => {
    saveToStorage(uploads)
  }, [uploads])

  const images = useMemo(() => {
    const byCat = activeCategory === 'All' ? uploads : uploads.filter((img) => img.category === activeCategory)
    const q = search.trim().toLowerCase()
    if (!q) return byCat
    return byCat.filter((img) => img.name.toLowerCase().includes(q) || img.category.toLowerCase().includes(q))
  }, [search, activeCategory, uploads])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setUploads((prev) => prev.filter((img) => img.id !== id))
  }

  if (!open) return null

  return (
    <div className="absolute inset-3 z-[70] flex flex-col rounded-xl border border-gray-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)]">

      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-[14px] font-semibold text-gray-900">Image Library</h2>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
          <X size={16} />
        </button>
      </div>

      {/* ── Search + Upload ── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-5 py-3">
        <div className="relative flex flex-1 items-center">
          <Search size={13} className="absolute left-2.5 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search images…"
            className="h-8 w-full rounded-lg border border-gray-200 pl-8 pr-3 text-[12px] outline-none focus:border-blue-300"
          />
        </div>

        {/* Upload-to category picker + Upload button */}
        <div className="relative flex items-center">
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            {/* Category selector */}
            <button
              type="button"
              onClick={() => setShowUploadCategoryMenu((o) => !o)}
              className="flex items-center gap-1 border-r border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600 hover:bg-gray-100"
            >
              <span className="max-w-[110px] truncate">{uploadCategory}</span>
              <ChevronDown size={10} className={cn('shrink-0 transition-transform', showUploadCategoryMenu && 'rotate-180')} />
            </button>
            {/* Upload button */}
            <label className="inline-flex cursor-pointer items-center gap-1.5 bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-700">
              <Upload size={11} />
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
                    setUploads((prev) => [
                      {
                        id: `upload-${Date.now()}`,
                        name: file.name.replace(/\.[^.]+$/, ''),
                        src,
                        category: uploadCategory,
                        uploadedAt: new Date().toISOString(),
                        deletable: true,
                      },
                      ...prev,
                    ])
                    setShowUploadCategoryMenu(false)
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </label>
          </div>

          {/* Category dropdown menu */}
          {showUploadCategoryMenu && (
            <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Upload to category
              </p>
              {IMAGE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setUploadCategory(cat); setShowUploadCategoryMenu(false) }}
                  className={cn(
                    'flex w-full items-center px-3 py-2 text-left text-[12px] transition-colors hover:bg-gray-50',
                    uploadCategory === cat ? 'font-semibold text-gray-900' : 'text-gray-600',
                  )}
                >
                  {uploadCategory === cat && <span className="mr-2 text-blue-500">✓</span>}
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Category filter chips ── */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-gray-100 px-5 py-2 scrollbar-none">
        {(['All', ...IMAGE_CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
              activeCategory === cat
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-800',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Image grid ── */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {images.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-gray-300">
            <Search size={28} />
            <p className="text-[12px]">No images in this category yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="overflow-hidden rounded-lg border border-gray-200 transition-all hover:border-blue-300 hover:shadow-sm"
              >
                {/* Image (click to select) */}
                <button type="button" onClick={() => onSelect(image.src)} className="w-full text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={image.name} className="h-24 w-full object-cover" />
                  <div className="px-2 pt-2 pb-1">
                    <div className="truncate text-[11px] font-medium text-gray-800">{image.name}</div>
                    <div className="truncate text-[9px] text-gray-400">{image.category}</div>
                  </div>
                </button>

                {/* Date + delete */}
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="text-[9px] text-gray-300">{formatDate(image.uploadedAt)}</span>
                  {image.deletable && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(image.id, e)}
                      className="rounded p-0.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Delete image"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
