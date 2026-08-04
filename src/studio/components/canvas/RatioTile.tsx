'use client'

import { cn } from '@studio/lib/utils'

/**
 * Tiny ratio-rectangle preview tile for ad-spec grids. The outer box stays
 * constant; the inner rect shrinks to match the ratio so the user reads the
 * proportions at a glance.
 */
export const RatioTile: React.FC<{
  width: number
  height: number
  selected: boolean
  onClick: () => void
  label: string
}> = ({ width, height, selected, onClick, label }) => {
  const ratio = width / height
  const boxW = 28
  const boxH = 28
  let w = boxW, h = boxH
  if (ratio >= 1) { h = Math.round(boxH / ratio) }
  else            { w = Math.round(boxW * ratio) }
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 transition-colors',
        selected
          ? 'border-blue-400 bg-blue-50 text-blue-600'
          : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50',
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center">
        <span
          className={cn('block rounded-[2px] border', selected ? 'border-blue-500' : 'border-gray-400')}
          style={{ width: w, height: h }}
        />
      </span>
      <span className="text-center text-[9px] font-medium leading-tight">{label}</span>
    </button>
  )
}
