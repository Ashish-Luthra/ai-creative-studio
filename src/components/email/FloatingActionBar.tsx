interface FloatingActionBarProps {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSaveToFavorites?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function FloatingActionBar({
  onMoveUp,
  onMoveDown,
  onSaveToFavorites,
  onDuplicate,
  onDelete,
}: FloatingActionBarProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 shrink-0">
      <button onClick={onMoveUp} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded transition-colors" title="Move up">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-gray-600"><path d="M10 15V5M10 5L5 10M10 5L15 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button onClick={onMoveDown} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded transition-colors" title="Move down">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-gray-600"><path d="M10 5V15M10 15L15 10M10 15L5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className="w-full h-px bg-gray-200 my-0.5" />
      <button onClick={onSaveToFavorites} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded transition-colors" title="Save to favorites">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-gray-600"><path d="M10 17.5L8.5 16.125C4.5 12.5 2 10.25 2 7.5C2 5.25 3.75 3.5 6 3.5C7.25 3.5 8.45 4.05 10 5.05C11.55 4.05 12.75 3.5 14 3.5C16.25 3.5 18 5.25 18 7.5C18 10.25 15.5 12.5 11.5 16.125L10 17.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      </button>
      <button onClick={onDuplicate} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded transition-colors" title="Duplicate block">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-gray-600"><rect x="7" y="7" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" /><path d="M13 7V3C13 2.44772 12.5523 2 12 2H3C2.44772 2 2 2.44772 2 3V12C2 12.5523 2.44772 13 3 13H7" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      <div className="w-full h-px bg-gray-200 my-0.5" />
      <button onClick={onDelete} className="w-9 h-9 flex items-center justify-center hover:bg-red-50 rounded transition-colors" title="Delete block">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-red-500"><path d="M3 5H17M8 5V3.5C8 3.22386 8.22386 3 8.5 3H11.5C11.7761 3 12 3.22386 12 3.5V5M15 5V16C15 16.5523 14.5523 17 14 17H6C5.44772 17 5 16.5523 5 16V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 9V13M12 9V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}
