import { UploadIcon } from './UploadIcon'

interface BlockPreviewProps {
  type: 'image-left-text-right' | 'centered-content' | 'text-over-image' | 'text-left-image-right'
  isSelected?: boolean
  onClick?: () => void
}

export function BlockPreview({ type, isSelected = false, onClick }: BlockPreviewProps) {
  const renderPreview = () => {
    switch (type) {
      case 'image-left-text-right':
        return (
          <div className="flex h-full">
            <div className="w-1/2 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={14} className="opacity-30" />
            </div>
            <div className="w-1/2 flex flex-col items-center justify-center p-4 gap-2">
              <div className="text-[6px] italic opacity-60">From The &lsquo;Gram</div>
              <div className="text-[9px] text-center leading-tight font-serif">
                The Post That Got Everyone Talking
              </div>
              <div className="w-6 h-px bg-gray-400 my-1" />
              <div className="text-[6px] bg-gray-200 px-2 py-1 rounded-sm">SEE IT</div>
            </div>
          </div>
        )

      case 'centered-content':
        return (
          <div className="h-full bg-gray-200 p-3 flex items-center justify-center">
            <div className="bg-white p-4 flex flex-col items-center gap-2">
              <div className="text-2xl font-serif opacity-70">6</div>
              <div className="text-[8px] text-center leading-tight font-serif">
                Tips to
                <br />
                Photograph
                <br />
                Food
              </div>
              <div className="text-[5px] text-center leading-tight opacity-60 mt-1">
                I remember my first try at food photography.
                <br />
                I created this guide to help you get started
                <br />
                without making all the mistakes I did.
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="text-[6px] opacity-40">001</div>
                <div className="text-[5px] bg-gray-400 text-white px-2 py-0.5">READ IT</div>
              </div>
            </div>
          </div>
        )

      case 'text-over-image':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center p-3">
              <div className="text-center">
                <div className="w-4 h-px bg-black mb-2 mx-auto" />
                <div className="text-[9px] font-bold leading-tight tracking-tight">
                  A LITTLE
                  <br />
                  GIFT OF THANKS
                  <br />
                  FOR JOINING
                  <br />
                  THE LIST.
                </div>
                <div className="w-4 h-px bg-black mt-2 mx-auto" />
              </div>
            </div>
            <div className="h-24 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={14} className="opacity-30" />
            </div>
          </div>
        )

      case 'text-left-image-right':
        return (
          <div className="flex h-full">
            <div className="w-1/3 flex items-center justify-center">
              <div className="text-[9px] font-bold leading-none">
                WEL—
                <br />
                COME
              </div>
            </div>
            <div className="w-2/3 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={14} className="opacity-30" />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <button
      onClick={onClick}
      className={`
        w-full aspect-[3/2] bg-white border-2 rounded overflow-hidden
        transition-all hover:shadow-md hover:scale-[1.02]
        ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'}
      `}
    >
      {renderPreview()}
    </button>
  )
}
