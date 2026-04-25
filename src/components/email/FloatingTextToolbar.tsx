interface FloatingTextToolbarProps {
  position?: { top: number; left: number }
  onBold?: () => void
  onItalic?: () => void
  onUnderline?: () => void
}

export function FloatingTextToolbar({ position, onBold, onItalic, onUnderline }: FloatingTextToolbarProps) {
  if (!position) return null
  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 flex items-center gap-0.5 z-50"
      style={{ top: position.top, left: position.left }}
    >
      <button onClick={onBold} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded font-bold text-gray-700 text-sm" title="Bold">B</button>
      <button onClick={onItalic} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded italic text-gray-700 text-sm" title="Italic">I</button>
      <button onClick={onUnderline} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-700 text-sm" title="Underline"><span className="underline">U</span></button>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded" title="Align left">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M3 5h10M3 10h14M3 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
      <button className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded" title="Align center">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 5h10M3 10h14M6 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </div>
  )
}
