'use client'

import type { LucideIcon } from 'lucide-react'

export interface CapabilityCardProps {
  title: string
  description: string
  /** Fallback when no illustration tile is supplied. */
  icon: LucideIcon
  /** Full design tile (own rounded #ECF3FE background, 481×231). */
  illustrationSrc?: string
  onClick: () => void
}

export const CapabilityCard: React.FC<CapabilityCardProps> = ({
  title,
  description,
  icon: Icon,
  illustrationSrc,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col text-left"
  >
    {illustrationSrc ? (
      // The SVG carries its own rounded tile background, so it IS the tile.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={illustrationSrc}
        alt=""
        className="aspect-[481/231] w-full transition-transform duration-150 group-hover:scale-[1.02]"
      />
    ) : (
      <div className="flex h-28 w-full items-center justify-center rounded-xl bg-indigo-50 transition-colors group-hover:bg-indigo-100">
        <Icon size={32} strokeWidth={1.5} className="text-indigo-500" />
      </div>
    )}
    <div className="mt-3 text-[15px] font-semibold text-gray-900">{title}</div>
    <div className="mt-1 text-[13px] leading-snug text-gray-500">{description}</div>
  </button>
)
