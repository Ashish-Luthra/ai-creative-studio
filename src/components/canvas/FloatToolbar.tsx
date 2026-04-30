'use client'

import { type CSSProperties } from 'react'
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const BRAND_COLORS = ['#111827', '#2563EB', '#7C3AED', '#16A34A', '#DC2626', '#D97706']

export interface FloatToolbarProps {
  /** Position of the toolbar in canvas-relative coordinates */
  position: { x: number; y: number }
  fontFamily?: string
  fontSize?: number
  isBold?: boolean
  isItalic?: boolean
  isUnderline?: boolean
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  onFontChange?: (family: string) => void
  onSizeChange?: (size: number) => void
  onBoldToggle?: () => void
  onItalicToggle?: () => void
  onUnderlineToggle?: () => void
  onAlignChange?: (align: 'left' | 'center' | 'right') => void
  onColorChange?: (hex: string) => void
  className?: string
}

export const FloatToolbar: React.FC<FloatToolbarProps> = ({
  position,
  fontFamily = 'Inter',
  fontSize = 16,
  isBold = false,
  isItalic = false,
  isUnderline = false,
  textAlign = 'left',
  color = '#111827',
  onFontChange,
  onSizeChange,
  onBoldToggle,
  onItalicToggle,
  onUnderlineToggle,
  onAlignChange,
  onColorChange,
  className,
}) => {
  // Spec: backdrop-filter blur(12px), bg-white/70, border border-white/60, rounded-[10px], shadow-lg
  const style: CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    transform: 'translateY(-100%) translateY(-14px)',
    zIndex: 55,
  }

  return (
    <div
      style={style}
      className={cn(
        'flex items-center gap-0.5 whitespace-nowrap rounded-[10px] px-2 py-1.5',
        'border border-white/60 bg-white/70',
        'shadow-[0_4px_20px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06)]',
        'backdrop-blur-[12px]',
        className
      )}
    >
      {/* Font family selector */}
      <select
        value={fontFamily}
        onChange={(e) => onFontChange?.(e.target.value)}
        className="min-w-[82px] rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 py-1 text-[11px] font-medium text-gray-700 outline-none"
      >
        {['Inter', 'Helvetica', 'Georgia', 'Playfair Display', 'Space Grotesk'].map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>

      <Sep />

      {/* Font size */}
      <input
        type="number"
        value={fontSize}
        onChange={(e) => onSizeChange?.(Number(e.target.value))}
        className="w-9 rounded-[5px] border border-gray-200 bg-gray-50 px-1 py-1 text-center text-[11px] font-semibold text-gray-700 outline-none"
        min={8}
        max={200}
      />

      <Sep />

      {/* B / I / U */}
      <TbBtn
        onClick={onBoldToggle}
        active={isBold}
        title="Bold"
        className="font-bold"
      >
        <Bold size={11} />
      </TbBtn>
      <TbBtn
        onClick={onItalicToggle}
        active={isItalic}
        title="Italic"
      >
        <Italic size={11} />
      </TbBtn>
      <TbBtn
        onClick={onUnderlineToggle}
        active={isUnderline}
        title="Underline"
      >
        <Underline size={11} />
      </TbBtn>

      <Sep />

      {/* Color swatches */}
      {BRAND_COLORS.map((hex) => (
        <button
          key={hex}
          title={hex}
          onClick={() => onColorChange?.(hex)}
          style={{ background: hex }}
          className={cn(
            'h-[17px] w-[17px] rounded-[4px] border transition-transform hover:scale-110',
            color === hex ? 'border-blue-500 ring-1 ring-blue-500' : 'border-black/10'
          )}
        />
      ))}

      <Sep />

      {/* Align */}
      <TbBtn onClick={() => onAlignChange?.('left')} active={textAlign === 'left'} title="Align left">
        <AlignLeft size={11} />
      </TbBtn>
      <TbBtn onClick={() => onAlignChange?.('center')} active={textAlign === 'center'} title="Align center">
        <AlignCenter size={11} />
      </TbBtn>
      <TbBtn onClick={() => onAlignChange?.('right')} active={textAlign === 'right'} title="Align right">
        <AlignRight size={11} />
      </TbBtn>
    </div>
  )
}

/* ── Small helpers ─────────────────────────────────────────── */

const Sep = () => <div className="mx-1 h-[18px] w-px bg-black/10" />

interface TbBtnProps {
  onClick?: () => void
  active?: boolean
  title?: string
  children: React.ReactNode
  className?: string
}
const TbBtn: React.FC<TbBtnProps> = ({ onClick, active, title, children, className }) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(
      'flex items-center justify-center rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors',
      active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-black/5',
      className
    )}
  >
    {children}
  </button>
)
