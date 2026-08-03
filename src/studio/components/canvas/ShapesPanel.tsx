'use client'

export type ShapeKind = 'rectangle' | 'oval' | 'line' | 'arrow' | 'triangle' | 'star' | 'polygon'

interface ShapesPanelProps {
  onInsert: (kind: ShapeKind) => void
  /** Render in-flow inside CanvasRightSidebar instead of floating. */
  embedded?: boolean
}

const TILES: { kind: ShapeKind; label: string; svg: React.ReactNode }[] = [
  {
    kind: 'rectangle',
    label: 'Rectangle',
    svg: <rect x="6" y="10" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />,
  },
  {
    kind: 'oval',
    label: 'Oval',
    svg: <ellipse cx="16" cy="16" rx="11" ry="7" stroke="currentColor" strokeWidth="1.6" fill="none" />,
  },
  {
    kind: 'line',
    label: 'Line',
    svg: <line x1="6" y1="22" x2="26" y2="10" stroke="currentColor" strokeWidth="1.6" />,
  },
  {
    kind: 'arrow',
    label: 'Arrow',
    svg: (
      <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="16" x2="24" y2="16" />
        <polyline points="20,11 25,16 20,21" />
      </g>
    ),
  },
  {
    kind: 'triangle',
    label: 'Triangle',
    svg: <polygon points="16,6 26,24 6,24" stroke="currentColor" strokeWidth="1.6" fill="none" />,
  },
  {
    kind: 'star',
    label: 'Star',
    svg: (
      <polygon
        points="16,4 19,12 28,12 21,17 24,26 16,21 8,26 11,17 4,12 13,12"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
    ),
  },
  {
    kind: 'polygon',
    label: 'Polygon',
    svg: <polygon points="16,5 26,11 26,21 16,27 6,21 6,11" stroke="currentColor" strokeWidth="1.6" fill="none" />,
  },
]

export const ShapesPanel: React.FC<ShapesPanelProps> = ({ onInsert, embedded = false }) => (
  <aside className={embedded
    ? 'w-full bg-white px-3 py-1'
    : 'absolute right-5 top-20 z-50 w-72 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm'}>
    {!embedded && <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Shapes</h3>}
    <div className="grid grid-cols-3 gap-2">
      {TILES.map(({ kind, label, svg }) => (
        <button
          key={kind}
          onClick={() => onInsert(kind)}
          title={`Insert ${label.toLowerCase()}`}
          className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 px-2 py-3 text-[11px] text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
            {svg}
          </svg>
          {label}
        </button>
      ))}
    </div>
    <p className="mt-3 text-[10px] leading-snug text-gray-400">
      Click a shape to drop it on the canvas. Drag to reposition. Select it to change colour.
    </p>
  </aside>
)
