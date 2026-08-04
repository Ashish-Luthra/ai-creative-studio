import { UploadIcon } from './UploadIcon'

export type BlockType =
  | 'image-left-text-right'
  | 'centered-content'
  | 'text-over-image'
  | 'text-left-image-right'
  | 'recipe-card'
  | 'image-top-text-bottom'
  | 'testimonial'

interface BlockPreviewProps {
  type: BlockType
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
              <div className="text-[9px] text-center leading-tight font-serif">The Post That Got Everyone Talking</div>
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
              <div className="text-[8px] text-center leading-tight font-serif">Tips to<br/>Photograph<br/>Food</div>
              <div className="text-[5px] text-center leading-tight opacity-60 mt-1">I remember my first try at food photography.<br/>I created this guide to help you get started.</div>
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
                <div className="text-[9px] font-bold leading-tight tracking-tight">A LITTLE<br/>GIFT OF THANKS<br/>FOR JOINING<br/>THE LIST.</div>
                <div className="w-4 h-px bg-black mt-2 mx-auto" />
              </div>
            </div>
            <div className="h-20 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={12} className="opacity-30" />
            </div>
          </div>
        )
      case 'text-left-image-right':
        return (
          <div className="flex h-full">
            <div className="w-1/3 flex items-center justify-center">
              <div className="text-[9px] font-bold leading-none">WEL—<br/>COME</div>
            </div>
            <div className="w-2/3 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={14} className="opacity-30" />
            </div>
          </div>
        )
      case 'recipe-card':
        return (
          <div className="flex h-full p-2 gap-2">
            <div className="w-1/2 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={12} className="opacity-30" />
            </div>
            <div className="w-1/2 flex flex-col justify-center gap-1">
              <div className="text-[6px] italic opacity-50">One</div>
              <div className="text-[8px] leading-tight">Click here for my creamy</div>
              <div className="text-[7px] italic opacity-60 leading-tight">butternut squash soup</div>
            </div>
          </div>
        )
      case 'image-top-text-bottom':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={14} className="opacity-30" />
            </div>
            <div className="bg-gray-100 p-2 text-center">
              <div className="text-[7px] leading-tight mb-0.5">Get 25% off when you book my services</div>
              <div className="text-[6px] italic opacity-60">for the next 24 hours only.</div>
            </div>
          </div>
        )
      case 'testimonial':
        return (
          <div className="flex h-full p-2 gap-2 bg-gray-50">
            <div className="w-1/4 bg-gray-300 flex items-center justify-center">
              <UploadIcon size={10} className="opacity-30" />
            </div>
            <div className="flex-1 flex flex-col justify-center gap-1">
              <div className="text-[7px] font-bold">TESTIMONIAL NAME</div>
              <div className="text-[5px] leading-tight opacity-70">Since joining, my email list has grown 4x...</div>
              <div className="text-[8px]">★★★★☆</div>
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
      className={`w-full aspect-[3/2] bg-white border-2 rounded overflow-hidden transition-all hover:shadow-md hover:scale-[1.01] ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'}`}
    >
      {renderPreview()}
    </button>
  )
}
