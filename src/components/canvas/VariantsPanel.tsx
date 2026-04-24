'use client'

export interface CanvasVariant {
  id: string
  label: string
  presetId: string
  copyText: string
  imageUrl: string
  thumbnail: string
}

interface VariantsPanelProps {
  variants: CanvasVariant[]
  onGenerate: () => void
  onApply: (variantId: string) => void
  onExport: (variantId: string) => void
}

export const VariantsPanel: React.FC<VariantsPanelProps> = ({
  variants,
  onGenerate,
  onApply,
  onExport,
}) => {
  return (
    <aside className="absolute right-5 top-20 z-50 w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Variants</h3>
      <p className="mb-3 text-sm text-gray-600">Generate, compare, and apply creative variants.</p>
      <button
        onClick={onGenerate}
        className="mb-3 w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
      >
        Generate Variants
      </button>

      <div className="max-h-80 space-y-2 overflow-auto pr-1">
        {variants.map((variant) => (
          <div key={variant.id} className="rounded-lg border border-gray-200 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={variant.thumbnail} alt={variant.label} className="mb-2 h-24 w-full rounded object-cover" />
            <div className="text-xs font-semibold text-gray-800">{variant.label}</div>
            <div className="mb-2 truncate text-[11px] text-gray-500">{variant.copyText}</div>
            <div className="flex gap-1">
              <button onClick={() => onApply(variant.id)} className="flex-1 rounded border border-gray-300 px-2 py-1 text-[11px]">
                Apply
              </button>
              <button onClick={() => onExport(variant.id)} className="flex-1 rounded bg-blue-600 px-2 py-1 text-[11px] text-white">
                Export
              </button>
            </div>
          </div>
        ))}
        {variants.length === 0 && (
          <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
            No variants yet. Generate from current creative.
          </div>
        )}
      </div>
    </aside>
  )
}
