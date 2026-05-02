'use client'

import { AllyvateIcon } from '@/components/ai/AllyvateAssistant'

interface CanvasAllyDockProps {
  visible: boolean
  onClick: () => void
}

export const CanvasAllyDock: React.FC<CanvasAllyDockProps> = ({ visible, onClick }) => {
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ask Allyvate"
      className="fixed bottom-6 right-6 z-[80] flex h-8 w-8 items-center justify-center rounded-full border border-[#1B51B3]/30 bg-white/95 shadow-xl backdrop-blur-sm transition-shadow hover:shadow-2xl"
    >
      <AllyvateIcon size={17} />
    </button>
  )
}
