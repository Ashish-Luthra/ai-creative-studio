'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Search, Upload, X, Trash2, ChevronDown, Monitor } from 'lucide-react'
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

// ─── Upload source picker modal ───────────────────────────────────────────────

// eslint-disable-next-line @next/next/no-img-element
const GoogleDriveLogo  = () => <img src="/brand-logos/google-drive.svg"  alt="Google Drive"  width={36} height={36} />
// eslint-disable-next-line @next/next/no-img-element
const OneDriveLogo     = () => <img src="/brand-logos/onedrive.svg"      alt="OneDrive"      width={44} height={32} />
// eslint-disable-next-line @next/next/no-img-element
const DropboxLogo      = () => <img src="/brand-logos/dropbox.svg"       alt="Dropbox"       width={36} height={36} />
// eslint-disable-next-line @next/next/no-img-element
const BynderLogo       = () => <img src="/brand-logos/bynder.svg"        alt="Bynder"        width={80} height={28} />

interface UploadSourcePickerProps {
  uploadCategory: string
  onComputerFiles: (files: FileList) => void
  onClose: () => void
}

function UploadSourcePicker({ uploadCategory, onComputerFiles, onClose }: UploadSourcePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const SOURCES = [
    {
      id: 'computer',
      label: 'My Computer',
      sublabel: 'Bulk upload supported',
      logo: (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
          <Monitor size={22} />
        </div>
      ),
      badge: null,
      action: () => fileInputRef.current?.click(),
    },
    {
      id: 'gdrive',
      label: 'Google Drive',
      sublabel: 'Connect your Drive',
      logo: <GoogleDriveLogo />,
      badge: 'Coming soon',
      action: null,
    },
    {
      id: 'onedrive',
      label: 'Microsoft OneDrive',
      sublabel: 'Connect your OneDrive',
      logo: <OneDriveLogo />,
      badge: 'Coming soon',
      action: null,
    },
    {
      id: 'dropbox',
      label: 'Dropbox',
      sublabel: 'Connect your Dropbox',
      logo: <DropboxLogo />,
      badge: 'Coming soon',
      action: null,
    },
    {
      id: 'bynder',
      label: 'Bynder / Brandfolder',
      sublabel: 'DAM integration',
      logo: <BynderLogo />,
      badge: 'Coming soon',
      action: null,
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[100] w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Upload Images</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              Uploading to <span className="font-medium text-gray-600">{uploadCategory}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Source grid */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {SOURCES.map((src) => (
            <button
              key={src.id}
              type="button"
              disabled={!src.action}
              onClick={() => src.action?.()}
              className={cn(
                'group relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                src.action
                  ? 'border-gray-200 hover:border-[#1B51B3] hover:shadow-md cursor-pointer'
                  : 'border-gray-100 bg-gray-50 cursor-default opacity-80',
                // span Computer card across full width on its own row
                src.id === 'computer' && 'col-span-2 flex-row items-center',
              )}
            >
              {/* Coming soon badge */}
              {src.badge && (
                <span className="absolute right-3 top-3 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                  {src.badge}
                </span>
              )}

              <div className="shrink-0">{src.logo}</div>

              <div className="min-w-0">
                <p className={cn(
                  'text-[13px] font-semibold leading-tight',
                  src.action ? 'text-gray-800 group-hover:text-[#1B51B3]' : 'text-gray-500',
                )}>
                  {src.label}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400">{src.sublabel}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Hidden multi-file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onComputerFiles(e.target.files)
              onClose()
            }
          }}
        />
      </div>
    </>
  )
}

// ─── Image grid (reused for single-category + per-group in All view) ─────────

function ImageGrid({
  images,
  onSelect,
  onDelete,
}: {
  images: ImageEntry[]
  onSelect: (src: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {images.map((image) => (
        <div
          key={image.id}
          className="overflow-hidden rounded-lg border border-gray-200 transition-all hover:border-blue-300 hover:shadow-sm"
        >
          <button type="button" onClick={() => onSelect(image.src)} className="w-full text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.name} className="h-24 w-full object-cover" />
            <div className="px-2 pt-2 pb-1">
              <div className="truncate text-[11px] font-medium text-gray-800">{image.name}</div>
              <div className="truncate text-[9px] text-gray-400">{image.category}</div>
            </div>
          </button>
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[9px] text-gray-300">{formatDate(image.uploadedAt)}</span>
            {image.deletable && (
              <button
                type="button"
                onClick={(e) => onDelete(image.id, e)}
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
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ApprovedImagesPanel: React.FC<ApprovedImagesPanelProps> = ({ open, onClose, onSelect }) => {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<ImageCategory | 'All'>('All')
  const [uploadCategory, setUploadCategory] = useState<ImageCategory>('Uncategorised')
  const [showUploadCategoryMenu, setShowUploadCategoryMenu] = useState(false)
  const [showSourcePicker, setShowSourcePicker] = useState(false)
  // Lazy initialiser — reads localStorage once at mount, before any effect runs.
  const [uploads, setUploads] = useState<ImageEntry[]>(() => loadFromStorage())

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

  // Handles bulk file upload from the computer source
  const handleComputerFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const src = String(reader.result ?? '')
        if (!src) return
        setUploads((prev) => [
          {
            id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name.replace(/\.[^.]+$/, ''),
            src,
            category: uploadCategory,
            uploadedAt: new Date().toISOString(),
            deletable: true,
          },
          ...prev,
        ])
      }
      reader.readAsDataURL(file)
    })
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

        {/* Category selector + Upload button */}
        <div className="relative flex items-center">
          <div className="flex overflow-hidden rounded-lg border border-gray-200">
            {/* Category for upload */}
            <button
              type="button"
              onClick={() => setShowUploadCategoryMenu((o) => !o)}
              className="flex items-center gap-1 border-r border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600 hover:bg-gray-100"
            >
              <span className="max-w-[110px] truncate">{uploadCategory}</span>
              <ChevronDown size={10} className={cn('shrink-0 transition-transform', showUploadCategoryMenu && 'rotate-180')} />
            </button>
            {/* Upload → opens source picker */}
            <button
              type="button"
              onClick={() => { setShowUploadCategoryMenu(false); setShowSourcePicker(true) }}
              className="inline-flex items-center gap-1.5 bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-700 transition-colors"
            >
              <Upload size={11} />
              Upload
            </button>
          </div>

          {/* Category dropdown */}
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
        ) : activeCategory !== 'All' ? (
          /* ── Single-category flat grid ── */
          <ImageGrid images={images} onSelect={onSelect} onDelete={handleDelete} />
        ) : (
          /* ── All: grouped by category with divider headers ── */
          <div className="flex flex-col gap-6">
            {IMAGE_CATEGORIES.map((cat) => {
              const group = images.filter((img) => img.category === cat)
              if (group.length === 0) return null
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div className="mb-3 flex items-center gap-3">
                    <span className="shrink-0 text-[15px] font-bold text-gray-800">{cat}</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <ImageGrid images={group} onSelect={onSelect} onDelete={handleDelete} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Upload source picker modal ── */}
      {showSourcePicker && (
        <UploadSourcePicker
          uploadCategory={uploadCategory}
          onComputerFiles={handleComputerFiles}
          onClose={() => setShowSourcePicker(false)}
        />
      )}
    </div>
  )
}
