'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  Layers, LayoutGrid, Palette, FileText,
  Monitor, Smartphone, ChevronUp, ChevronDown, Trash2,
  Type, Plus, X, MousePointer2, ChevronsUpDown,
  Star, Link2, Share2, MapPin, Mail, Layout,
  Save, FolderOpen, ChevronDown as ChevronDownIcon, Check, Loader2, PlusCircle,
  Image as ImageIcon, Eye, EyeOff,
} from 'lucide-react'
import type { EmailerMeta } from '@/lib/supabase'
import type { CanvasBlock } from '@/types/canvas'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { useEmailStore } from '@/lib/email/emailStore'
import { BlockLibrary } from './BlockLibrary'
import { FloatingActionBar } from './FloatingActionBar'
import { TextEditPanel } from './TextEditPanel'
import { ApprovedImagesPanel } from '@/components/canvas/ApprovedImagesPanel'
import { AllyvateAssistant, type AllyContext } from '@/components/ai/AllyvateAssistant'
import { EmailRightNav } from './EmailRightNav'
import { GOOGLE_FONT_FAMILIES, getGoogleFontStylesheetHrefs } from '@/lib/canvas/googleFonts'
import { SPECS } from '@/lib/email/blockSpecs'

// ─── Types ────────────────────────────────────────────────────────────────────
// CanvasBlock is imported from @/types/canvas (shared with canvasConverter)
// Re-export so existing imports of CanvasBlock from this file continue to work.
export type { CanvasBlock } from '@/types/canvas'

type EmailTab = 'tree' | 'sections' | 'text' | 'content' | 'style'

// afterId: null = insert at very top; string = insert after that block id
type InsertState = { afterId: string | null } | null

// ─── Canvas block type palette (structural blocks from left nav) ──────────────

const CANVAS_BLOCK_TYPES = [
  { id: 'logo',     label: 'Logo',     Icon: Star },
  { id: 'link-bar', label: 'Link Bar', Icon: Link2 },
  { id: 'content',  label: 'Content',  Icon: Layout },
  { id: 'text',     label: 'Text',     Icon: Type },
  { id: 'button',   label: 'Button',   Icon: MousePointer2 },
  { id: 'social',   label: 'Social',   Icon: Share2 },
  { id: 'address',  label: 'Address',  Icon: MapPin },
  { id: 'footer',   label: 'Footer',   Icon: Mail },
  { id: 'spacer',   label: 'Spacer',   Icon: ChevronsUpDown },
] as const

// Map all block type ids → display label (structural + prebuilt design blocks)
const BLOCK_LABEL: Record<string, string> = {
  'logo':                  'Logo',
  'link-bar':              'Link Bar',
  'content':               'Content',
  'text':                  'Text',
  'button':                'Button',
  'social':                'Social',
  'address':               'Address',
  'footer':                'Footer',
  'spacer':                'Spacer',
  'image-left-text-right': 'Image Left, Text Right',
  'centered-content':      'Centered Content',
  'text-over-image':       'Text Over Image',
  'text-left-image-right': 'Text Left, Image Right',
  'recipe-card':           'Recipe Card',
  'image-top-text-bottom': 'Image Top, Text Bottom',
  'testimonial':           'Testimonial',
}

// Web-safe system fonts for the global body font picker
const SYSTEM_FONTS_EMAIL = [
  'Arial', 'Georgia', 'Helvetica', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New',
]

// ─── Default canvas (email content flow) ─────────────────────────────────────

// Social platform definitions used in the canvas renderer
// (a lightweight list — just the platforms we want to display as icons on canvas)
const SOCIAL_PLATFORMS_CANVAS: { key: string; title: string; svg: React.ReactNode }[] = [
  { key: 'instagram', title: 'Instagram', svg: <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="m373.406 0h-234.812c-76.422 0-138.594 62.172-138.594 138.594v234.816c0 76.418 62.172 138.59 138.594 138.59h234.816c76.418 0 138.59-62.172 138.59-138.59v-234.816c0-76.422-62.172-138.594-138.594-138.594zm108.578 373.41c0 59.867-48.707 108.574-108.578 108.574h-234.812c-59.871 0-108.578-48.707-108.578-108.574v-234.816c0-59.871 48.707-108.578 108.578-108.578h234.816c59.867 0 108.574 48.707 108.574 108.578z"/><path d="m256 116.004c-77.195 0-139.996 62.8-139.996 139.996s62.8 139.996 139.996 139.996 139.996-62.8 139.996-139.996-62.8-139.996-139.996-139.996zm0 249.977c-60.641 0-109.98-49.336-109.98-109.981 0-60.64 49.34-109.98 109.98-109.98 60.645 0 109.98 49.34 109.98 109.98 0 60.645-49.335 109.981-109.98 109.981z"/><path d="m399.344 66.285c-22.813 0-41.367 18.559-41.367 41.367 0 22.813 18.554 41.371 41.367 41.371s41.371-18.558 41.371-41.371-18.558-41.367-41.371-41.367zm0 52.719c-6.258 0-11.351-5.094-11.351-11.352 0-6.261 5.093-11.351 11.351-11.351 6.262 0 11.355 5.09 11.355 11.351 0 6.258-5.093 11.352-11.355 11.352z"/></svg> },
  { key: 'facebook',  title: 'Facebook',  svg: <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="m40.4 55.2c-.3 0-6.9 0-9.9 0-1.6 0-2.1-.6-2.1-2.1 0-4 0-8.1 0-12.1 0-1.6.6-2.1 2.1-2.1h9.9c0-.3 0-6.1 0-8.8 0-4 .7-7.8 2.7-11.3 2.1-3.6 5.1-6 8.9-7.4 2.5-.9 5-1.3 7.7-1.3h9.8c1.4 0 2 .6 2 2v11.4c0 1.4-.6 2-2 2-2.7 0-5.4 0-8.1.1-2.7 0-4.1 1.3-4.1 4.1-.1 3 0 5.9 0 9h11.6c1.6 0 2.2.6 2.2 2.2v12.1c0 1.6-.5 2.1-2.2 2.1-3.6 0-11.3 0-11.6 0v32.6c0 1.7-.5 2.3-2.3 2.3-4.2 0-8.3 0-12.5 0-1.5 0-2.1-.6-2.1-2.1 0-10.5 0-32.4 0-32.7z"/></svg> },
  { key: 'pinterest', title: 'Pinterest', svg: <svg viewBox="0 0 511.977 511.977" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="M262.948,0C122.628,0,48.004,89.92,48.004,187.968c0,45.472,25.408,102.176,66.08,120.16c6.176,2.784,9.536,1.6,10.912-4.128c1.216-4.352,6.56-25.312,9.152-35.2c0.8-3.168,0.384-5.92-2.176-8.896c-13.504-15.616-24.224-44.064-24.224-70.752c0-68.384,54.368-134.784,146.88-134.784c80,0,135.968,51.968,135.968,126.304c0,84-44.448,142.112-102.208,142.112c-31.968,0-55.776-25.088-48.224-56.128c9.12-36.96,27.008-76.704,27.008-103.36c0-23.904-13.504-43.68-41.088-43.68c-32.544,0-58.944,32.224-58.944,75.488c0,27.488,9.728,46.048,9.728,46.048S144.676,371.2,138.692,395.488c-10.112,41.12,1.376,107.712,2.368,113.44c0.608,3.168,4.16,4.16,6.144,1.568c3.168-4.16,42.08-59.68,52.992-99.808c3.968-14.624,20.256-73.92,20.256-73.92c10.72,19.36,41.664,35.584,74.624,35.584c98.048,0,168.896-86.176,168.896-193.12C463.62,76.704,375.876,0,262.948,0z"/></svg> },
  { key: 'twitter',   title: 'X',         svg: <svg viewBox="0 0 1226.37 1226.37" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-5 w-5"><path d="m727.348 519.284 446.727-519.284h-105.86l-387.893 450.887-309.809-450.887h-357.328l468.492 681.821-468.492 544.549h105.866l409.625-476.152 327.181 476.152h357.328l-485.863-707.086zm-144.998 168.544-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721h-162.604l-323.311-462.446z"/></svg> },
  { key: 'youtube',   title: 'YouTube',   svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg> },
  { key: 'linkedin',  title: 'LinkedIn',  svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { key: 'tiktok',    title: 'TikTok',    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
  { key: 'twitter_x', title: 'X (Twitter)', svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { key: 'spotify',   title: 'Spotify',   svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg> },
  { key: 'github',    title: 'GitHub',    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg> },
  { key: 'telegram',  title: 'Telegram',  svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> },
  { key: 'threads',   title: 'Threads',   svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.868 1.205 8.617.024 12.197 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.371-.887h-.018c-.934 0-1.686.317-2.302 1.088L8.92 8.492c.81-1.051 2.019-1.606 3.496-1.606h.028c2.97.016 4.741 1.895 4.762 5.202l.004.067-.053.009c.816.345 1.489.834 2 1.447 1.058 1.274 1.313 2.945 1.096 4.462-.288 2.042-1.286 3.759-2.818 4.978-1.535 1.22-3.509 1.939-5.92 1.949h-.009z"/></svg> },
  { key: 'medium',    title: 'Medium',    svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg> },
  { key: 'discord',   title: 'Discord',   svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> },
  { key: 'substack',  title: 'Substack',  svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/></svg> },
  { key: 'website',   title: 'Website',   svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { key: 'linktree',  title: 'Linktree',  svg: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M13.511 5.853l4.005-4.117 2.394 2.393-4.2 4.2h5.784v3.348h-5.765l4.201 4.201-2.394 2.393-5.54-5.634-5.54 5.634-2.394-2.393 4.201-4.2H2.505V8.329h5.784l-4.2-4.2 2.393-2.393 4.005 4.117V0h3.024v5.853zM10.508 24v-8.82h3.024V24h-3.024z"/></svg> },
]

const DEFAULT_LINK_BAR: { label: string; url: string }[] = [
  { label: 'Home',     url: '' },
  { label: 'About',    url: '' },
  { label: 'Products', url: '' },
  { label: 'Blog',     url: '' },
  { label: 'Contact',  url: '' },
]

/** Creates a new CanvasBlock with sensible defaults pre-populated for block types that need them. */
function makeNewBlock(type: string): CanvasBlock {
  const base: CanvasBlock = { id: nanoid(), type }
  if (type === 'link-bar') return { ...base, linkBarItems: [...DEFAULT_LINK_BAR] }
  if (type === 'spacer')   return { ...base, spacerHeight: 64 }
  return base
}

function makeDefaultBlocks(): CanvasBlock[] {
  return [
    { id: nanoid(), type: 'logo' },
    { id: nanoid(), type: 'link-bar', linkBarItems: [...DEFAULT_LINK_BAR] },
    { id: nanoid(), type: 'spacer', spacerHeight: 64 },
    { id: nanoid(), type: 'footer' },
  ]
}

// ─── Inline Block Inserter ────────────────────────────────────────────────────

function BlockInserter({
  onSelect,
  onClose,
}: {
  onSelect: (type: string) => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 my-1 mx-auto max-w-[640px] bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
      <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mr-1 shrink-0">
        Add block:
      </span>
      <div className="flex items-center gap-1 flex-wrap flex-1">
        {CANVAS_BLOCK_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-blue-200 hover:bg-blue-100 hover:border-blue-400 text-blue-700 text-[10px] font-medium transition-colors shadow-sm"
          >
            <Icon size={9} />
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors ml-1"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── Tree / Layer Panel ───────────────────────────────────────────────────────

interface TreePanelProps {
  blocks: CanvasBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onDelete: (id: string) => void
}

function TreePanel({ blocks, selectedId, onSelect, onMoveUp, onMoveDown, onDelete }: TreePanelProps) {
  const getIcon = (type: string) => {
    const found = CANVAS_BLOCK_TYPES.find((b) => b.id === type)
    if (found) {
      const { Icon } = found
      return <Icon size={10} />
    }
    return <Layout size={10} />
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center border-b border-gray-100 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Layer Tree
        </span>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {blocks.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[11px] text-gray-400">No blocks yet.</p>
            <p className="text-[10px] text-gray-300 mt-1">Add from Sections or Right Nav.</p>
          </div>
        ) : (
          blocks.map((block, i) => (
            <div
              key={block.id}
              onClick={() => onSelect(block.id)}
              className={cn(
                'group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors',
                selectedId === block.id ? 'bg-blue-50' : 'hover:bg-gray-50',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                  selectedId === block.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {getIcon(block.type)}
              </span>
              <span
                className={cn(
                  'flex-1 truncate text-[11px] capitalize',
                  selectedId === block.id
                    ? 'font-medium text-blue-700'
                    : 'text-gray-600',
                )}
              >
                {BLOCK_LABEL[block.type] ?? block.type}
              </span>
              <div
                className={cn(
                  'flex items-center gap-0.5 transition-opacity',
                  selectedId === block.id
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveUp(block.id) }}
                  disabled={i === 0}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-20"
                >
                  <ChevronUp size={9} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveDown(block.id) }}
                  disabled={i === blocks.length - 1}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-20"
                >
                  <ChevronDown size={9} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(block.id) }}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-400"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Sections Panel ───────────────────────────────────────────────────────────

function SectionsPanel({
  onInsert,
  onBlockDragStart,
  onBlockDragEnd,
}: {
  onInsert: (type: string) => void
  onBlockDragStart?: (type: string) => void
  onBlockDragEnd?: () => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="px-3 pb-3 pt-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Email Blocks
        </p>
        <p className="mb-3 text-[10px] text-gray-400 leading-relaxed">
          Click to insert · Drag into a Content block
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {CANVAS_BLOCK_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              draggable
              onClick={() => onInsert(id)}
              onDragStart={(e) => {
                e.dataTransfer.setData('blockType', id)
                e.dataTransfer.effectAllowed = 'copy'
                onBlockDragStart?.(id)
              }}
              onDragEnd={onBlockDragEnd}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2.5 text-center transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm active:scale-95 cursor-grab active:cursor-grabbing"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                <Icon size={13} />
              </div>
              <span className="text-[9px] font-medium leading-tight text-gray-500">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Text Blocks Panel ────────────────────────────────────────────────────────

function TextBlocksPanel({ onInsert }: { onInsert: (type: string) => void }) {
  const TEXT_STYLES = [
    { id: 'h1',      label: 'Heading 1',  preview: 'Heading 1',   cls: 'text-xl font-bold' },
    { id: 'h2',      label: 'Heading 2',  preview: 'Heading 2',   cls: 'text-lg font-semibold' },
    { id: 'h3',      label: 'Heading 3',  preview: 'Heading 3',   cls: 'text-base font-medium' },
    { id: 'body',    label: 'Body Text',  preview: 'Body copy',   cls: 'text-sm' },
    { id: 'caption', label: 'Caption',    preview: 'Caption text', cls: 'text-xs text-gray-500 italic' },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Text Styles
      </p>
      <div className="flex flex-col gap-1.5">
        {TEXT_STYLES.map(({ id, label, preview, cls }) => (
          <button
            key={id}
            onClick={() => onInsert('text')}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50 active:scale-[0.99]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-400 shrink-0">
              <Type size={11} />
            </div>
            <div className="min-w-0">
              <p className={cn('text-gray-700 leading-tight truncate', cls)}>{preview}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Content Panel (replaces Settings) ───────────────────────────────────────

function ContentPanel({
  selectedBlock,
  onBlockColorChange,
}: {
  selectedBlock: CanvasBlock | null
  onBlockColorChange: (id: string, color: string) => void
}) {
  const { document: doc, updateSubject, updatePreheader, updateGlobalStyles } = useEmailStore()

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      {selectedBlock ? (
        <>
          {/* Selected block badge */}
          <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">Selected Block</p>
            <p className="mt-0.5 text-[12px] font-medium capitalize text-blue-800">
              {BLOCK_LABEL[selectedBlock.type] ?? selectedBlock.type}
            </p>
          </div>

          {/* Block background colour */}
          <Field label="Block Background">
            <div className="flex items-center gap-2">
              <ColorRow
                value={selectedBlock.backgroundColor ?? '#ffffff'}
                onChange={(v) => onBlockColorChange(selectedBlock.id, v)}
              />
              {selectedBlock.backgroundColor && selectedBlock.backgroundColor !== '#ffffff' && (
                <button
                  onClick={() => onBlockColorChange(selectedBlock.id, '#ffffff')}
                  title="Reset to white"
                  className="shrink-0 rounded border border-gray-200 px-2 py-1.5 text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-600"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Pick a colour to change this block&apos;s background
            </p>
          </Field>

          <div className="mb-3 h-px bg-gray-100" />
        </>
      ) : (
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-center">
          <p className="text-[11px] text-gray-400">Click a block on the canvas to style it</p>
        </div>
      )}

      <Field label="Subject Line">
        <input
          type="text"
          value={doc.subject}
          onChange={(e) => updateSubject(e.target.value)}
          placeholder="Your email subject…"
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      </Field>

      <Field label="Preheader Text">
        <textarea
          value={doc.preheader}
          onChange={(e) => updatePreheader(e.target.value)}
          placeholder="Preview text shown in inbox…"
          rows={2}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-gray-400">Shown after subject line in most clients</p>
      </Field>

      <Field label="Unsubscribe Text">
        <textarea
          value={doc.globalStyles.unsubscribeText}
          onChange={(e) => updateGlobalStyles({ unsubscribeText: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-gray-400">
          Use <code className="text-[10px]">[[unsubscribe]]</code> for the link
        </p>
      </Field>
    </div>
  )
}

// ─── Block Properties Panel (Right Nav — shown when a block is selected) ─────

const BG_SWATCHES = [
  '#ffffff','#f9fafb','#f3f4f6','#e5e7eb','#d1d5db',
  '#111827','#1f2937','#374151','#6b7280','#9ca3af',
  '#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#3b82f6',
  '#fdf4ff','#fae8ff','#e9d5ff','#c084fc','#a855f7',
  '#fdf2f8','#fce7f3','#fbcfe8','#f9a8d4','#ec4899',
  '#fff7ed','#ffedd5','#fed7aa','#fb923c','#f97316',
  '#f0fdf4','#dcfce7','#bbf7d0','#86efac','#22c55e',
  '#fefce8','#fef9c3','#fef08a','#fde047','#eab308',
]

interface BlockPropertiesPanelProps {
  block: CanvasBlock
  onColorChange: (id: string, color: string) => void
  onBack: () => void
}

function BlockPropertiesPanel({ block, onColorChange, onBack }: BlockPropertiesPanelProps) {
  const bg = block.backgroundColor ?? '#ffffff'

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Block Style
        </span>
        <button
          onClick={onBack}
          className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Blocks
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">

        {/* Selected block badge */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">
            Selected
          </p>
          <p className="mt-0.5 text-[12px] font-medium capitalize text-blue-800">
            {BLOCK_LABEL[block.type] ?? block.type}
          </p>
        </div>

        {/* Background colour */}
        <div>
          <label className="mb-2 block text-[10px] font-medium text-gray-500">
            Background Colour
          </label>

          {/* Native colour input + hex field row */}
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5">
            <input
              type="color"
              value={bg}
              onChange={(e) => onColorChange(block.id, e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={bg}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  onColorChange(block.id, e.target.value)
                }
              }}
              maxLength={7}
              className="flex-1 text-[12px] text-gray-600 focus:outline-none"
            />
            {bg !== '#ffffff' && (
              <button
                onClick={() => onColorChange(block.id, '#ffffff')}
                className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Swatch grid */}
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {BG_SWATCHES.map((colour) => (
              <button
                key={colour}
                onClick={() => onColorChange(block.id, colour)}
                title={colour}
                className={cn(
                  'h-8 w-full rounded-md border transition-transform hover:scale-105',
                  bg === colour ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200',
                )}
                style={{ backgroundColor: colour }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Style Panel ──────────────────────────────────────────────────────────────

function StylePanel() {
  const { document: doc, updateGlobalStyles } = useEmailStore()
  const g = doc.globalStyles

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <Field label="Email Background">
        <ColorRow value={g.backgroundColor} onChange={(v) => updateGlobalStyles({ backgroundColor: v })} />
      </Field>

      <Field label="Body Font">
        <select
          value={g.fontFamily}
          onChange={(e) => updateGlobalStyles({ fontFamily: e.target.value })}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
        >
          <optgroup label="System Fonts">
            {SYSTEM_FONTS_EMAIL.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </optgroup>
          <optgroup label="Google Fonts">
            {GOOGLE_FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </optgroup>
        </select>
      </Field>

      <Field label="Link Colour">
        <ColorRow value={g.linkColor} onChange={(v) => updateGlobalStyles({ linkColor: v })} />
      </Field>

      <Field label="Content Width">
        <div className="flex gap-1.5">
          {[600, 640].map((w) => (
            <button
              key={w}
              onClick={() => updateGlobalStyles({ contentWidth: w })}
              className={cn(
                'flex-1 rounded-md border py-1.5 text-[11px] font-medium transition-colors',
                g.contentWidth === w
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              {w}px
            </button>
          ))}
        </div>
      </Field>

      <Field label="Logo URL">
        <input
          type="text"
          placeholder="https://…/logo.png"
          value={g.logo?.src ?? ''}
          onChange={(e) =>
            updateGlobalStyles({
              logo: { src: e.target.value, alt: g.logo?.alt ?? 'Logo', width: g.logo?.width ?? 120 },
            })
          }
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      </Field>
    </div>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[10px] font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-[12px] text-gray-600 focus:outline-none"
        maxLength={7}
      />
    </div>
  )
}

// ─── Rail button ──────────────────────────────────────────────────────────────

function RailBtn({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[9px] font-medium transition-colors',
        active ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
      )}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  )
}

// ─── ResizableImageSlot ────────────────────────────────────────────────────────
// Renders an image that:
//  • shows a "Double-click to change" overlay on hover
//  • exposes a bottom-right drag handle to resize height (width stays 100% of column)
//  • never distorts (object-cover always active)

interface ResizableImageSlotProps {
  src: string
  alt: string
  height?: number
  className?: string
  style?: React.CSSProperties  // e.g. clip-path for image shape
  onDoubleClick: () => void
  onResize: (newHeight: number) => void
  onImageClick?: (e: React.MouseEvent) => void
}

function ResizableImageSlot({
  src, alt, height, className, style, onDoubleClick, onResize, onImageClick,
}: ResizableImageSlotProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startH = wrapRef.current ? wrapRef.current.offsetHeight : (height ?? 240)
    dragRef.current = { startY: e.clientY, startH }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const newH = Math.max(60, dragRef.current.startH + (ev.clientY - dragRef.current.startY))
      onResize(Math.round(newH))
    }
    const onUp = (ev: MouseEvent) => {
      if (dragRef.current) {
        const newH = Math.max(60, dragRef.current.startH + (ev.clientY - dragRef.current.startY))
        onResize(Math.round(newH))
      }
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={wrapRef}
      className={cn('group relative overflow-hidden', className)}
      style={{ ...(style ?? {}), ...(height != null ? { height } : {}) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onClick={(e) => { e.stopPropagation(); onImageClick?.(e) }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
        draggable={false}
      />
      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/25">
        <span className="rounded bg-black/60 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Double-click to change
        </span>
      </div>
      {/* Bottom-right resize handle */}
      <div
        className="absolute bottom-0 right-0 z-10 hidden h-5 w-5 cursor-se-resize items-end justify-end pb-1 pr-1 group-hover:flex"
        onMouseDown={startResize}
        title="Drag to resize"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-white drop-shadow-md">
          <path d="M1 7L7 1M4 7L7 4M7 7V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  )
}

// ─── BlockContent: full-size block renderer (9 structural + 7 prebuilt) ───────

function BlockContent({
  type,
  backgroundColor,
  onTextClick,
  imageSrcs = {},
  imageSizes = {},
  onImageDoubleClick,
  onImageResize,
  onImageClick,
  // Button settings
  buttonShapeVariant,
  buttonFillColor,
  buttonBorderColor,
  buttonPosition,
  buttonBorderWidth,
  buttonWidth,
  buttonHeight,
  buttonFontFamily,
  // Font settings
  fontFamily,
  fontSize,
  fontBold,
  fontWeight,
  fontItalic,
  fontUnderline,
  fontColor,
  textAlign,
  lineHeight,
  letterSpacing,
  fontCase,
  // Image settings
  imageShape,
  onButtonAreaClick,
  // Content block
  contentLayout,
  onContentLayoutSelect,
  spacerHeight,
  linkBarItems,
  footerLinks,
  socialLinks,
  socialIconStyle,
  socialIconColor,
  socialIconSize,
  socialIconPosition,
  socialIconSpacing,
  contentHeight,
  contentButton,
  isDraggingButton,
  onDropButton,
  onContentButtonRemove,
  texts,
  textStyles,
  onTextChange,
  onTextFocus,
}: {
  type: string
  backgroundColor?: string
  onTextClick: (e: React.MouseEvent) => void
  imageSrcs?: Record<string, string>
  imageSizes?: Record<string, number>
  onImageDoubleClick: (key: string) => void
  onImageResize: (key: string, height: number) => void
  onImageClick?: (e: React.MouseEvent) => void
  buttonShapeVariant?: number
  buttonFillColor?: string
  buttonBorderColor?: string
  buttonPosition?: 'left' | 'center' | 'right'
  buttonBorderWidth?: number
  buttonWidth?: number
  buttonHeight?: number
  buttonFontFamily?: string
  fontFamily?: string
  fontSize?: number
  fontBold?: boolean
  fontWeight?: number
  fontItalic?: boolean
  fontUnderline?: boolean
  fontColor?: string
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  fontCase?: 'none' | 'lowercase' | 'uppercase'
  imageShape?: string
  /** Separate handler for button elements so they route to the Button tab, not Font tab */
  onButtonAreaClick?: (e: React.MouseEvent) => void
  contentLayout?: string
  onContentLayoutSelect?: (layout: string) => void
  spacerHeight?: number
  linkBarItems?: { label: string; url: string }[]
  footerLinks?: { label: string; url: string }[]
  socialLinks?: Record<string, string>
  socialIconStyle?: 'outline' | 'filled'
  socialIconColor?: string
  socialIconSize?: 'S' | 'M' | 'L'
  socialIconPosition?: 'left' | 'center' | 'right'
  socialIconSpacing?: number
  contentHeight?: number
  contentButton?: { position: 'below-text' | 'on-image'; label: string } | null
  isDraggingButton?: boolean
  onDropButton?: (pos: 'below-text' | 'on-image') => void
  onContentButtonRemove?: () => void
  texts?: Record<string, string>
  textStyles?: CanvasBlock['textStyles']
  onTextChange?: (key: string, html: string) => void
  onTextFocus?: (key: string) => void
}) {
  // ── Button style derivation ──────────────────────────────────────────────────
  const BTN_SHAPES = [
    { radius: '0px',   filled: true  },
    { radius: '4px',   filled: true  },
    { radius: '12px',  filled: true  },
    { radius: '999px', filled: true  },
    { radius: '0px',   filled: false },
    { radius: '4px',   filled: false },
    { radius: '12px',  filled: false },
    { radius: '999px', filled: false },
  ]
  const btnShape  = BTN_SHAPES[buttonShapeVariant ?? 0]
  const btnFill   = buttonFillColor   ?? '#1F2937'
  const btnBorder = buttonBorderColor ?? '#1F2937'
  // Visual (shape/color) styles — always applied to button wrapper
  const btnVisualStyle: React.CSSProperties = {
    borderRadius:    btnShape.radius,
    backgroundColor: btnShape.filled ? btnFill : 'transparent',
    border:          `${buttonBorderWidth ?? 1}px solid ${btnBorder}`,
    color:           btnShape.filled ? '#FFFFFF' : btnFill,
    width:           buttonWidth  ? `${buttonWidth}px`  : undefined,
    height:          buttonHeight ? `${buttonHeight}px` : undefined,
  }
  // Keep btnStyle for backward-compat with embeddedBtn
  const btnStyle = btnVisualStyle
  const btnJustify = { left: 'flex-start', center: 'center', right: 'flex-end' }[buttonPosition ?? 'center']

  // ── Font style derivation ────────────────────────────────────────────────────
  const fontStyle: React.CSSProperties = {
    fontFamily:      fontFamily    ?? undefined,
    fontSize:        fontSize      ? `${fontSize}px`        : undefined,
    fontWeight:      fontWeight    ?? (fontBold ? 700 : undefined),
    fontStyle:       fontItalic    ? 'italic'               : undefined,
    textDecoration:  fontUnderline ? 'underline'            : undefined,
    color:           fontColor     ?? undefined,
    textAlign:       textAlign     ?? undefined,
    lineHeight:      lineHeight    ?? undefined,
    letterSpacing:   letterSpacing ? `${letterSpacing}px`  : undefined,
    textTransform:   fontCase && fontCase !== 'none' ? fontCase : undefined,
  }

  // ── Image shape clip ─────────────────────────────────────────────────────────
  const IMAGE_CLIP: Record<string, React.CSSProperties> = {
    circle:  { borderRadius: '50%' },
    rounded: { borderRadius: '12px' },
    square:  { borderRadius: '0' },
    arch:    { borderRadius: '50% 50% 0 0' },
    diamond: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
    hexagon: { clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' },
  }
  const imgClip = imageShape ? (IMAGE_CLIP[imageShape] ?? {}) : {}

  const EDITABLE_CLASS = 'outline-none cursor-text border-2 border-transparent hover:border-blue-200 rounded px-1 transition-colors'

  // Merge block-level fontStyle + spec overrides + per-field textStyles override
  function resolveFieldStyle(key: string, extraStyle: React.CSSProperties = {}): React.CSSProperties {
    const ts = textStyles?.[key]
    const override: React.CSSProperties = {}
    if (ts) {
      if (ts.fontFamily  !== undefined) override.fontFamily    = ts.fontFamily
      if (ts.fontSize    !== undefined) override.fontSize      = ts.fontSize
      if (ts.fontWeight  !== undefined) override.fontWeight    = ts.fontWeight
      else if (ts.fontBold !== undefined) override.fontWeight  = ts.fontBold    ? 700         : 400
      if (ts.fontItalic  !== undefined) override.fontStyle     = ts.fontItalic  ? 'italic'    : 'normal'
      if (ts.fontUnderline !== undefined) override.textDecoration = ts.fontUnderline ? 'underline' : 'none'
      if (ts.fontColor   !== undefined) override.color         = ts.fontColor
      if (ts.textAlign   !== undefined) override.textAlign     = ts.textAlign
      if (ts.fontCase    !== undefined) override.textTransform = ts.fontCase === 'none' ? 'none' : ts.fontCase
      if (ts.lineHeight  !== undefined) override.lineHeight    = ts.lineHeight
      if (ts.letterSpacing !== undefined) override.letterSpacing = `${ts.letterSpacing}px`
    }
    return { ...fontStyle, ...extraStyle, ...override }
  }

  // Returns all props for an editable text field (heading, body, tagline, etc.)
  function editableField(key: string, defaultText: string, extraStyle: React.CSSProperties = {}) {
    return {
      contentEditable: true as const,
      suppressContentEditableWarning: true,
      onClick: onTextClick,
      onFocus: () => onTextFocus?.(key),
      onBlur: (e: React.FocusEvent<HTMLElement>) => onTextChange?.(key, e.currentTarget.innerHTML),
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          const sel = window.getSelection()
          if (!sel?.rangeCount) return
          const range = sel.getRangeAt(0)
          range.deleteContents()
          const br = document.createElement('br')
          range.insertNode(br)
          range.setStartAfter(br)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      },
      className: EDITABLE_CLASS,
      dangerouslySetInnerHTML: { __html: texts?.[key] ?? defaultText },
      style: resolveFieldStyle(key, extraStyle),
    }
  }

  // Returns all props for an editable button label field
  function buttonField(key: string, defaultText: string, extraStyle: React.CSSProperties = {}) {
    // Resolve font properties for this button field (family, size, weight, case, etc.)
    // but exclude color — button text color is determined by fill/outline mode, not fontColor.
    const { color: _ignored, ...btnFontStyle } = resolveFieldStyle(key, extraStyle)
    return {
      contentEditable: true as const,
      suppressContentEditableWarning: true,
      onClick: onButtonAreaClick ?? onTextClick,
      onFocus: () => { onTextFocus?.(key) },
      onBlur: (e: React.FocusEvent<HTMLElement>) => onTextChange?.(key, e.currentTarget.innerHTML),
      className: EDITABLE_CLASS,
      dangerouslySetInnerHTML: { __html: texts?.[key] ?? defaultText },
      // Visual styles first (shape, bg, border, text-color), font styles on top (no color override)
      style: { ...btnVisualStyle, ...btnFontStyle },
    }
  }

  // Legacy spread for elements that still use children (e.g. embedded content buttons with a remove icon inside)
  const buttonEditable = {
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    onClick: onButtonAreaClick ?? onTextClick,
    className: EDITABLE_CLASS,
  }

  // Inline bg style — overrides Tailwind bg-* classes on the outermost element
  const bg = backgroundColor ? { backgroundColor } : {}

  // ── Structural blocks ──────────────────────────────────────────────────────

  if (type === 'logo') {
    const logoSrc = imageSrcs['logo']
    return (
      <div className="flex items-center justify-center bg-white py-6" style={bg}>
        {logoSrc ? (
          <div className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="Logo"
              className="max-h-16 max-w-[200px] object-contain"
              draggable={false}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onImageDoubleClick('logo') }}
              className="absolute inset-0 flex items-center justify-center rounded bg-black/0 text-transparent transition-all group-hover:bg-black/30 group-hover:text-white"
            >
              <span className="rounded bg-black/60 px-2 py-1 text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                Change logo
              </span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onImageDoubleClick('logo') }}
            className="flex h-14 w-44 flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-gray-300">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-300">
              Upload Logo
            </span>
          </button>
        )}
      </div>
    )
  }

  if (type === 'link-bar') {
    const items = (linkBarItems && linkBarItems.length > 0) ? linkBarItems : DEFAULT_LINK_BAR
    return (
      <div className="flex items-center justify-center gap-6 border-b border-gray-100 bg-white px-8 py-3" style={bg}>
        {items.map((item, i) => (
          <a
            key={i}
            href={item.url || '#'}
            onClick={(e) => e.preventDefault()}
            className="text-[11px] font-medium tracking-wide text-gray-600 hover:text-gray-900 hover:underline transition-colors"
          >
            {item.label}
          </a>
        ))}
      </div>
    )
  }

  if (type === 'content') {
    // ── Layout picker — shown when no inner layout is chosen yet ─────────────
    if (!contentLayout) {
      const OPTIONS = [
        {
          id: '2col-text', label: '2 Column Text',
          preview: (
            <div className="grid grid-cols-2 gap-1 w-full h-full p-2">
              <div className="flex flex-col gap-0.5">
                <div className="h-1.5 w-3/4 rounded-sm bg-gray-400" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 w-2/3 rounded-sm bg-gray-200" />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="h-1.5 w-3/4 rounded-sm bg-gray-400" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 w-2/3 rounded-sm bg-gray-200" />
              </div>
            </div>
          ),
        },
        {
          id: '3col-text', label: '3 Column Text',
          preview: (
            <div className="grid grid-cols-3 gap-1 w-full h-full p-2">
              {[0,1,2].map((i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="h-1.5 rounded-sm bg-gray-400" />
                  <div className="h-1 rounded-sm bg-gray-200" />
                  <div className="h-1 rounded-sm bg-gray-200" />
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'image', label: 'Image',
          preview: (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 rounded-sm m-2 overflow-hidden">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="#9CA3AF" strokeWidth="1.5"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="#9CA3AF"/>
                <path d="M21 15l-5-5L5 21" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          ),
        },
        {
          id: 'image-text', label: 'Image + Text',
          preview: (
            <div className="flex gap-1.5 w-full h-full p-2">
              <div className="w-1/2 flex items-center justify-center bg-gray-100 rounded-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#9CA3AF" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="#9CA3AF"/>
                  <path d="M21 15l-5-5L5 21" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-0.5">
                <div className="h-1.5 w-full rounded-sm bg-gray-400" />
                <div className="h-1 rounded-sm bg-gray-200" />
                <div className="h-1 w-3/4 rounded-sm bg-gray-200" />
              </div>
            </div>
          ),
        },
      ]
      return (
        <div className="bg-white px-8 py-6" style={bg}>
          <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Choose content layout
          </p>
          <div className="grid grid-cols-2 gap-3">
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.(opt.id) }}
                className="group flex flex-col overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
              >
                <div className="h-16 w-full">{opt.preview}</div>
                <p className="border-t border-gray-200 py-1.5 text-center text-[10px] font-medium text-gray-500 group-hover:text-blue-600">
                  {opt.label}
                </p>
              </button>
            ))}
          </div>
        </div>
      )
    }

    // ── Shared helpers ────────────────────────────────────────────────────────
    const dropZoneBelow = (
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('below-text') }}
        className={cn(
          'mx-8 mb-4 flex items-center justify-center rounded-xl border-2 border-dashed py-3 text-[10px] font-medium transition-all',
          isDraggingButton
            ? 'border-blue-400 bg-blue-50 text-blue-500 opacity-100'
            : 'border-transparent opacity-0 pointer-events-none',
        )}
      >
        Drop button here
      </div>
    )

    const embeddedBtn = contentButton ? (
      <div className="relative flex items-center justify-center px-8 py-4" style={{ justifyContent: btnJustify }}>
        <div
          {...buttonEditable}
          style={btnStyle}
          className="relative inline-flex items-center justify-center px-5 py-2 text-[13px] font-semibold"
        >
          {contentButton.label}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onContentButtonRemove?.() }}
            className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-800 text-[8px] text-white opacity-0 transition-opacity hover:bg-red-500 group-hover/cbtn:opacity-100"
            title="Remove button"
          >
            ✕
          </button>
        </div>
      </div>
    ) : null

    // ── 2-column text ────────────────────────────────────────────────────────
    if (contentLayout === '2col-text') {
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="grid grid-cols-2 divide-x divide-gray-100 px-2 py-8"
            style={contentHeight ? { minHeight: contentHeight } : undefined}
          >
            <div className="flex flex-col gap-2 px-8">
              <h4 {...editableField('col1-heading', 'Column One Heading', { fontSize: '14px', fontWeight: 600 })} />
              <p {...editableField('col1-body', 'Add your text here. Click to edit this column and tell your story.', { fontSize: '14px', lineHeight: 1.6, color: '#4B5563' })} />
            </div>
            <div className="flex flex-col gap-2 px-8">
              <h4 {...editableField('col2-heading', 'Column Two Heading', { fontSize: '14px', fontWeight: 600 })} />
              <p {...editableField('col2-body', 'Add your text here. Click to edit this column and share more details.', { fontSize: '14px', lineHeight: 1.6, color: '#4B5563' })} />
            </div>
          </div>
          {contentButton?.position === 'below-text' ? embeddedBtn : dropZoneBelow}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }

    // ── 3-column text ────────────────────────────────────────────────────────
    if (contentLayout === '3col-text') {
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="grid grid-cols-3 divide-x divide-gray-100 px-2 py-8"
            style={contentHeight ? { minHeight: contentHeight } : undefined}
          >
            {([1, 2, 3] as const).map((n) => (
              <div key={n} className="flex flex-col gap-2 px-6">
                <h4 {...editableField(`col${n}-heading`, `Column ${['One','Two','Three'][n-1]}`, { fontSize: '14px', fontWeight: 600 })} />
                <p {...editableField(`col${n}-body`, 'Click to edit this column.', { fontSize: '12px', lineHeight: 1.6, color: '#4B5563' })} />
              </div>
            ))}
          </div>
          {contentButton?.position === 'below-text' ? embeddedBtn : dropZoneBelow}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }

    // ── Image only ───────────────────────────────────────────────────────────
    if (contentLayout === 'image') {
      const imgSrc = imageSrcs['content-img']
      const hasOnImageBtn = contentButton?.position === 'on-image'
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="relative"
            style={contentHeight ? { minHeight: contentHeight } : undefined}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('on-image') }}
          >
            {imgSrc ? (
              <ResizableImageSlot
                src={imgSrc}
                alt="Content"
                height={imageSizes['content-img'] ?? 320}
                onDoubleClick={() => onImageDoubleClick('content-img')}
                onResize={(h) => onImageResize('content-img', h)}
                onImageClick={onImageClick}
              />
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onImageDoubleClick('content-img') }}
                className="flex w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 bg-gray-50 py-16 transition-all hover:border-blue-400 hover:bg-blue-50"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-300">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[11px] font-medium text-gray-400">Click to add image</span>
              </button>
            )}
            {/* On-image drop hint */}
            {isDraggingButton && !hasOnImageBtn && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded border-2 border-dashed border-blue-400 bg-blue-500/10">
                <span className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-medium text-blue-600 shadow">
                  Drop button on image
                </span>
              </div>
            )}
            {/* On-image embedded button */}
            {hasOnImageBtn && (
              <div className="absolute inset-0 flex items-end justify-center pb-6">
                <div
                  {...buttonEditable}
                  style={btnStyle}
                  className="relative inline-flex items-center justify-center px-5 py-2 text-[13px] font-semibold"
                >
                  {contentButton!.label}
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onContentButtonRemove?.() }}
                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-800 text-[8px] text-white opacity-0 transition-opacity hover:bg-red-500 group-hover/cbtn:opacity-100"
                    title="Remove button"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }

    // ── Image + Text ─────────────────────────────────────────────────────────
    if (contentLayout === 'image-text') {
      const imgSrc = imageSrcs['content-img']
      const hasOnImageBtn = contentButton?.position === 'on-image'
      return (
        <div className="group/cbtn bg-white" style={bg}>
          <div
            className="flex"
            style={{ minHeight: contentHeight ?? 200 }}
          >
            {/* Image half */}
            <div
              className="relative w-1/2"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('on-image') }}
            >
              {imgSrc ? (
                <ResizableImageSlot
                  src={imgSrc}
                  alt="Content"
                  height={imageSizes['content-img'] ?? 240}
                  className="w-full self-stretch"
                  onDoubleClick={() => onImageDoubleClick('content-img')}
                  onResize={(h) => onImageResize('content-img', h)}
                  onImageClick={onImageClick}
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onImageDoubleClick('content-img') }}
                  className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-blue-400 hover:bg-blue-50"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-gray-300">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[10px] font-medium text-gray-400">Click to add image</span>
                </button>
              )}
              {isDraggingButton && !hasOnImageBtn && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded border-2 border-dashed border-blue-400 bg-blue-500/10">
                  <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-blue-600 shadow">
                    Drop on image
                  </span>
                </div>
              )}
              {hasOnImageBtn && (
                <div className="absolute inset-0 flex items-end justify-center pb-4">
                  <div
                    {...buttonEditable}
                    style={btnStyle}
                    className="relative inline-flex items-center justify-center px-4 py-1.5 text-[12px] font-semibold"
                  >
                    {contentButton!.label}
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onContentButtonRemove?.() }}
                      className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-800 text-[8px] text-white opacity-0 transition-opacity hover:bg-red-500 group-hover/cbtn:opacity-100"
                      title="Remove button"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Text half */}
            <div
              className="flex w-1/2 flex-col justify-center gap-3 px-8 py-8"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropButton?.('below-text') }}
            >
              <h4 {...editableField('heading', 'Content Heading', { fontSize: '14px', fontWeight: 600 })} />
              <p {...editableField('body', 'Click to edit this text. Tell your story alongside the image.', { fontSize: '14px', lineHeight: 1.6, color: '#4B5563' })} />
              {isDraggingButton && !contentButton && (
                <div className="rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 py-2 text-center text-[10px] font-medium text-blue-500">
                  Drop button below text
                </div>
              )}
              {contentButton?.position === 'below-text' && embeddedBtn}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onContentLayoutSelect?.('') }}
            className="w-full border-t border-gray-100 py-1 text-[9px] font-medium uppercase tracking-wider text-gray-300 hover:text-blue-500 transition-colors"
          >
            ↺ Change layout
          </button>
        </div>
      )
    }
  }

  if (type === 'text') {
    return (
      <div className="bg-white px-12 py-8" style={bg}>
        <p {...editableField('body', 'Your text content here. Click to edit this paragraph and add your own copy.', { fontSize: '14px', lineHeight: 1.6, color: '#374151' })} />
      </div>
    )
  }

  if (type === 'button') {
    return (
      <div className="bg-white py-8" style={{ ...bg, display: 'flex', alignItems: 'center', justifyContent: btnJustify, paddingLeft: 48, paddingRight: 48 }}>
        <div {...buttonField('label', 'CLICK HERE', { padding: '12px 40px', fontSize: '14px', fontWeight: 600, letterSpacing: '0.1em' })} />
      </div>
    )
  }

  if (type === 'social') {
    // Default icons shown when no links are configured yet
    const DEFAULT_SOCIAL_KEYS = ['instagram', 'facebook', 'pinterest', 'twitter']
    const links = socialLinks ?? {}
    const linkedKeys = Object.keys(links).filter((k) => links[k])
    // Show linked platforms if any, otherwise show default placeholders
    const keysToShow = linkedKeys.length > 0 ? linkedKeys : DEFAULT_SOCIAL_KEYS

    // Icon style and sizing
    const iconStyle = socialIconStyle ?? 'outline'
    const iconColor = socialIconColor ?? '#1F2937'
    const iconSize = socialIconSize ?? 'M'
    const iconPosition = socialIconPosition ?? 'center'
    const iconSpacing = socialIconSpacing ?? 12

    // Size mapping
    const sizeMap = { S: 32, M: 40, L: 48 }
    const iconPx = sizeMap[iconSize]
    const borderWidth = iconStyle === 'filled' ? 0 : 1

    // Position alignment
    const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' }

    return (
      <div
        className="flex flex-wrap items-center bg-white px-6 py-6"
        style={{ ...bg, justifyContent: justifyMap[iconPosition], gap: `${iconSpacing}px` }}
      >
        {keysToShow.map((key) => {
          const platform = SOCIAL_PLATFORMS_CANVAS.find((p) => p.key === key)
          if (!platform) return null
          const url = links[key] || '#'
          return (
            <a
              key={key}
              href={url}
              title={platform.title}
              className="flex items-center justify-center rounded-full transition-all hover:scale-110"
              style={{
                width: `${iconPx}px`,
                height: `${iconPx}px`,
                borderWidth: `${borderWidth}px`,
                borderColor: iconColor,
                borderStyle: 'solid',
                backgroundColor: iconStyle === 'filled' ? iconColor : 'transparent',
                color: iconStyle === 'filled' ? '#ffffff' : iconColor,
              }}
              onClick={(e) => e.preventDefault()}
            >
              {platform.svg}
            </a>
          )
        })}
      </div>
    )
  }

  if (type === 'address') {
    return (
      <div className="bg-white px-12 py-4 text-center" style={bg}>
        <p {...editableField('address', '123 Main Street, Suite 100 · City, State 12345 · United States', { fontSize: '11px', lineHeight: 1.6, color: '#6B7280' })} />
      </div>
    )
  }

  if (type === 'footer') {
    const DEFAULT_FOOTER_LINKS = [
      { label: 'Privacy Policy', url: '' },
      { label: 'Unsubscribe',    url: '' },
      { label: 'View in Browser', url: '' },
      { label: 'Contact Us',     url: '' },
    ]
    const fLinks = (footerLinks && footerLinks.length > 0) ? footerLinks : DEFAULT_FOOTER_LINKS
    return (
      <div className="bg-gray-50 px-12 py-6 text-center" style={bg}>
        <div className="mb-3 flex items-center justify-center gap-4 text-[11px] text-gray-500">
          {fLinks.map((link, i) => (
            <React.Fragment key={i}>
              <a
                href={link.url || '#'}
                onClick={(e) => e.preventDefault()}
                className="cursor-pointer hover:text-gray-800 hover:underline transition-colors"
              >
                {link.label}
              </a>
              {i < fLinks.length - 1 && <span className="text-gray-300">·</span>}
            </React.Fragment>
          ))}
        </div>
        <p {...editableField('copyright', `© ${new Date().getFullYear()} Your Company Name. All rights reserved.`, { fontSize: '10px', color: '#9CA3AF' })} />
      </div>
    )
  }

  if (type === 'spacer') {
    const spacerPx = spacerHeight ?? 64
    return (
      <div
        className="flex items-center justify-center border-y border-dashed border-gray-200 bg-white"
        style={{ ...bg, height: spacerPx }}
      >
        <span className="text-[9px] font-medium uppercase tracking-widest text-gray-300">
          Spacer · {spacerPx}px
        </span>
      </div>
    )
  }

  // ── Prebuilt design blocks (from right nav) ────────────────────────────────

  if (type === 'image-left-text-right') {
    const S = SPECS.IMAGE_LEFT_TEXT_RIGHT
    return (
      <div className="flex min-h-[300px]" style={bg}>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Fashion"
          height={imageSizes[S.imageKey]}
          className="self-stretch"
          style={{ width: `${S.imageColPct}%` }}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
        <div className="flex flex-col items-center justify-center gap-4"
          style={{ width: `${S.textColPct}%`, padding: S.textPaddingH }}>
          <p {...editableField('tagline', "From The 'Gram", { fontSize: S.taglineFontSize, color: S.taglineColor, fontStyle: 'italic', textAlign: 'center' })} />
          <h2 {...editableField('heading', 'The Post That Got Everyone Talking', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, textAlign: 'center' })} />
          <div style={{ height: 1, width: 64, backgroundColor: S.dividerColor }} />
          <div style={{ display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonField('button', S.buttonLabel, { padding: '8px 24px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' })} />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'centered-content') {
    const S = SPECS.CENTERED_CONTENT
    return (
      <div className="text-center" style={{ backgroundColor: bg.backgroundColor ?? S.outerBg, padding: S.outerPadding.top }}>
        <div className="inline-block rounded shadow-sm" style={{ backgroundColor: S.cardBg, borderRadius: S.cardBorderRadius, padding: S.cardPadding }}>
          <div {...editableField('number', '6', { fontSize: S.numberFontSize, color: S.numberColor, lineHeight: S.numberLineHeight })} />
          <h3 {...editableField('heading', 'Tips to Photograph Food', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, marginTop: 8 })} />
          <p {...editableField('body', 'I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.', { fontSize: S.bodyFontSize, color: S.bodyColor, maxWidth: S.bodyMaxWidthPx, margin: '12px auto 0', lineHeight: S.bodyLineHeight })} />
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: btnJustify, gap: 12 }}>
            <span style={{ fontSize: S.labelFontSize, color: S.labelColor }}>001</span>
            <div {...buttonField('button', S.buttonLabel, { padding: '8px 24px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' })} />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'text-over-image') {
    const S = SPECS.TEXT_OVER_IMAGE
    return (
      <div style={{ backgroundColor: bg.backgroundColor ?? S.bgColor }}>
        <div className="text-center" style={{ padding: S.sectionPadding.top }}>
          <div style={{ margin: '0 auto 16px', height: 1, width: 64, backgroundColor: S.dividerColor }} />
          <h3 {...editableField('heading', 'A Little Gift of Thanks for Joining the List.', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, letterSpacing: S.headingTracking, textTransform: 'uppercase', textAlign: 'center' })} />
          <div style={{ margin: '16px auto 0', height: 1, width: 64, backgroundColor: S.dividerColor }} />
          <div style={{ marginTop: 24, display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonField('button', S.buttonLabel, { paddingTop: S.buttonPadding.top, paddingBottom: S.buttonPadding.top, paddingLeft: S.buttonPadding.right, paddingRight: S.buttonPadding.right, fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' })} />
          </div>
        </div>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Background"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
      </div>
    )
  }

  if (type === 'text-left-image-right') {
    const S = SPECS.TEXT_LEFT_IMAGE_RIGHT
    return (
      <div className="flex min-h-[300px]" style={bg}>
        <div className="flex flex-col items-center justify-center gap-6"
          style={{ width: `${S.textColPct}%`, padding: S.textPaddingH }}>
          <h3 {...editableField('heading', 'WEL—COME', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, lineHeight: S.headingLineHeight })} />
          <div style={{ display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonField('button', S.buttonLabel, { padding: '8px 24px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' })} />
          </div>
        </div>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Background"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          style={{ width: `${S.imageColPct}%` }}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
      </div>
    )
  }

  if (type === 'recipe-card') {
    const S = SPECS.RECIPE_CARD
    return (
      <div className="flex min-h-[280px] gap-8" style={{ backgroundColor: bg.backgroundColor ?? S.bgColor }}>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Recipe"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          style={{ width: `${S.imageColPct}%`, ...imgClip }}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
        <div className="flex flex-col justify-center gap-3 px-4" style={{ width: `${S.textColPct}%` }}>
          <p {...editableField('label', 'One', { fontSize: S.labelFontSize, color: S.labelColor, fontStyle: 'italic' })} />
          <h3 {...editableField('heading', 'Click here for my creamy butternut squash soup', { fontSize: S.headingFontSize, fontWeight: S.headingWeight })} />
          <p {...editableField('description', 'A warming recipe perfect for fall evenings.', { fontSize: S.descFontSize, color: S.descColor, fontStyle: 'italic' })} />
          <div style={{ display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonField('button', S.buttonLabel, { padding: '8px 24px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' })} />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'image-top-text-bottom') {
    const S = SPECS.IMAGE_TOP_TEXT_BOTTOM
    return (
      <div style={{ backgroundColor: S.imageSectionBg }}>
        <ResizableImageSlot
          src={imageSrcs[S.imageKey] ?? S.defaultImageSrc}
          alt="Main image"
          height={imageSizes[S.imageKey] ?? S.defaultImageHeight}
          onDoubleClick={() => onImageDoubleClick(S.imageKey)}
          onResize={(h) => onImageResize(S.imageKey, h)}
          onImageClick={onImageClick}
        />
        <div className="text-center" style={{ backgroundColor: bg.backgroundColor ?? S.textBg, padding: S.textPadding.top }}>
          <h3 {...editableField('heading', 'Get 25% off when you book my services', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, marginBottom: S.headingBottomMargin })} />
          <p {...editableField('body', 'for the next 24 hours only.', { fontSize: S.bodyFontSize, color: S.bodyColor, fontStyle: 'italic' })} />
          <div style={{ marginTop: 24, display: 'flex', justifyContent: btnJustify }}>
            <div {...buttonField('button', S.buttonLabel, { paddingTop: S.buttonPadding.top, paddingBottom: S.buttonPadding.top, paddingLeft: S.buttonPadding.right, paddingRight: S.buttonPadding.right, fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' })} />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'testimonial') {
    const S = SPECS.TESTIMONIAL
    return (
      <div className="flex min-h-[200px] gap-8"
        style={{ backgroundColor: bg.backgroundColor ?? S.bgColor, padding: `${S.sectionPadding.top}px ${S.sectionPadding.right}px` }}>
        <ResizableImageSlot
          src={imageSrcs[S.avatarKey] ?? S.defaultAvatarSrc}
          alt="Testimonial"
          height={imageSizes[S.avatarKey] ?? S.avatarWidth}
          style={{ width: S.avatarWidth, flexShrink: 0, ...imgClip }}
          onDoubleClick={() => onImageDoubleClick(S.avatarKey)}
          onResize={(h) => onImageResize(S.avatarKey, h)}
          onImageClick={onImageClick}
        />
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h4 {...editableField('name', 'TESTIMONIAL NAME', { fontSize: S.nameFontSize, fontWeight: S.nameWeight, letterSpacing: S.nameTracking, textTransform: 'uppercase' })} />
          <p {...editableField('quote', "Since joining, my email list has grown 4x and I've finally found a system that works for my creative business.", { fontSize: S.quoteFontSize, color: S.quoteColor, lineHeight: S.quoteLineHeight })} />
          <div style={{ fontSize: S.starFontSize, color: S.starColor }}>{S.starsText}</div>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="flex h-24 items-center justify-center bg-gray-50 text-sm text-gray-400">
      Unknown block: {type}
    </div>
  )
}

// ─── Main EmailEditorPanel ────────────────────────────────────────────────────

export const EmailEditorPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EmailTab>('sections')
  const [panelOpen, setPanelOpen] = useState(true)

  // Canvas state
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>(makeDefaultBlocks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [insertState, setInsertState] = useState<InsertState>(null)
  const [showTextEdit, setShowTextEdit] = useState(false)
  const [activeTextKey, setActiveTextKey] = useState<string | null>(null)
  const [showApprovedImages, setShowApprovedImages] = useState(false)
  const [pendingImageTarget, setPendingImageTarget] = useState<{ blockId: string; imageKey: string } | null>(null)
  // Signals EmailRightNav which tab to activate when a specific element is clicked
  const [focusTab, setFocusTab] = useState<{ tab: string; seq: number } | undefined>()
  // Tracks which block type is currently being dragged from the sections panel
  const [draggedBlockType, setDraggedBlockType] = useState<string | null>(null)

  // ── Allyvate AI assistant ───────────────────────────────────────────────────
  const [allyVisible,  setAllyVisible]  = useState(false)
  const [allyContext,  setAllyContext]  = useState<AllyContext>('text')
  const [allyAnchorX, setAllyAnchorX]  = useState(0)
  const [allyAnchorY, setAllyAnchorY]  = useState(0)

  const showAlly = useCallback((ctx: AllyContext, e: React.MouseEvent) => {
    setAllyContext(ctx)
    setAllyAnchorX(e.clientX)
    setAllyAnchorY(e.clientY)
    setAllyVisible(true)
  }, [])

  // ── Persistence state ───────────────────────────────────────────────────────
  const [currentEmailerId, setCurrentEmailerId] = useState<string | null>(null)
  const [savedEmailers, setSavedEmailers] = useState<EmailerMeta[]>([
    { id: 'demo-1', name: 'Dormant User — Winter Win-Back Campaign',   subject: 'We miss you! Here\'s 20% off to welcome you back',  preheader: null, created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
    { id: 'demo-2', name: 'Summer Flash Sale — 48 Hour Countdown',     subject: 'Only 48 hrs left: up to 50% off sitewide',           preheader: null, created_at: '2025-02-10T09:00:00Z', updated_at: '2025-02-10T09:00:00Z' },
    { id: 'demo-3', name: 'New Product Launch — Spring Collection',    subject: 'Introducing our brand-new Spring 2025 line',         preheader: null, created_at: '2025-03-01T08:00:00Z', updated_at: '2025-03-01T08:00:00Z' },
    { id: 'demo-4', name: 'Monthly Newsletter — April Edition',        subject: 'Your April update: tips, stories & exclusive offers', preheader: null, created_at: '2025-04-01T07:00:00Z', updated_at: '2025-04-01T07:00:00Z' },
    { id: 'demo-5', name: 'VIP Early Access — Members Only Preview',   subject: 'You\'re invited: shop 24 hours before everyone else', preheader: null, created_at: '2025-04-20T06:00:00Z', updated_at: '2025-04-20T06:00:00Z' },
  ])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showEmailerDropdown, setShowEmailerDropdown] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalMode, setSaveModalMode] = useState<'new' | 'fork'>('new')
  const [emailerNameInput, setEmailerNameInput] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { document: doc, previewMode, setPreviewMode, updateSubject, updatePreheader, syncFromCanvas, compiledHtml, setEmailerName } = useEmailStore()

  // Toggle between live canvas editing and iframe-based email HTML preview
  const [showPreview, setShowPreview] = useState(false)

  // ── Font-enriched preview HTML ─────────────────────────────────────────────
  // srcDoc iframes run with a null origin, which means they cannot reuse the
  // parent page's cached Google Fonts connections in all browsers.  We pre-inject
  // <link> tags for every font in the full catalogue so the preview shows the
  // correct font immediately — these same fonts are already loaded by the root
  // layout, so browsers that share the cache serve them from memory.
  // NOTE: these extra links are injected for preview only; the exported HTML still
  // only embeds the specific fonts actually used in the document (as compiled).
  const previewSrcDoc = useMemo(() => {
    if (!compiledHtml) return ''
    const extraLinks = getGoogleFontStylesheetHrefs()
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join('')
    return compiledHtml.replace('</head>', `${extraLinks}</head>`)
  }, [compiledHtml])

  // ── Sync canvas → emailStore on every canvas change ─────────────────────────
  // This bridges the CanvasBlock[] visual model with the EmailDocument compiler
  // model so that compiled HTML always reflects what the user sees on canvas.
  useEffect(() => {
    void syncFromCanvas(canvasBlocks)
    // syncFromCanvas is stable (Zustand action ref never changes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasBlocks])

  // Fetch emailer list on mount — only replace dummy data if real rows come back
  useEffect(() => {
    fetch('/api/emailers')
      .then((r) => r.ok ? r.json() : null)
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setSavedEmailers(list as EmailerMeta[])
        }
      })
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowEmailerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buildPayload = useCallback(() => ({
    subject:   doc.subject   ?? null,
    preheader: doc.preheader ?? null,
    blocks:    canvasBlocks,
  }), [doc.subject, doc.preheader, canvasBlocks])

  // Save (update) the current emailer
  const handleSave = useCallback(async () => {
    if (!currentEmailerId) {
      // No ID yet → open "save as new" modal
      setSaveModalMode('new')
      setEmailerNameInput(doc.subject || 'Untitled')
      setShowSaveModal(true)
      return
    }
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/emailers/${currentEmailerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json() as EmailerMeta
      setSavedEmailers((prev) => prev.map((e) => e.id === updated.id ? updated : e))
      setEmailerName(updated.name)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [currentEmailerId, buildPayload, doc.subject, setEmailerName])

  // Confirm save (new or fork) from modal
  const handleSaveConfirm = useCallback(async () => {
    const name = emailerNameInput.trim() || 'Untitled'
    setShowSaveModal(false)
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/emailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...buildPayload() }),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = await res.json() as EmailerMeta
      if (saveModalMode === 'new') setCurrentEmailerId(created.id)
      setSavedEmailers((prev) => [created, ...prev])
      setEmailerName(created.name)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [emailerNameInput, buildPayload, saveModalMode, setEmailerName])

  // Load an emailer from Supabase into the canvas
  const handleLoadEmailer = useCallback(async (id: string) => {
    setShowEmailerDropdown(false)
    setSaveStatus('saving') // reuse spinner while loading
    try {
      const res = await fetch(`/api/emailers/${id}`)
      if (!res.ok) throw new Error()
      const row = await res.json() as {
        id: string
        name: string
        subject: string | null
        preheader: string | null
        blocks: CanvasBlock[]
      }
      // Restore canvas blocks
      setCanvasBlocks(Array.isArray(row.blocks) ? row.blocks : [])
      setCurrentEmailerId(row.id)
      // Restore subject + preheader into the email store so buildPayload
      // and the subject input both reflect the loaded emailer
      updateSubject(row.subject ?? '')
      updatePreheader(row.preheader ?? '')
      setEmailerName(row.name)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [updateSubject, updatePreheader, setEmailerName])

  const handleTabClick = (tab: EmailTab) => {
    if (activeTab === tab) setPanelOpen((o) => !o)
    else { setActiveTab(tab); setPanelOpen(true) }
  }

  const RAIL_ITEMS: { id: EmailTab; icon: React.ReactNode; label: string }[] = [
    { id: 'tree',     icon: <Layers size={14} />,     label: 'Tree' },
    { id: 'sections', icon: <LayoutGrid size={14} />, label: 'Sections' },
    { id: 'text',     icon: <Type size={14} />,       label: 'Text' },
    { id: 'content',  icon: <FileText size={14} />,   label: 'Content' },
    { id: 'style',    icon: <Palette size={14} />,    label: 'Style' },
  ]

  // ── Canvas block actions ────────────────────────────────────────────────────

  const handleMoveUp = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx <= 0) return prev
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const handleMoveDown = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [])

  const handleDuplicate = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0) return prev
      const copy: CanvasBlock = { ...prev[idx], id: nanoid() }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setCanvasBlocks((prev) => prev.filter((b) => b.id !== id))
    setSelectedId((prev) => (prev === id ? null : prev))
    setInsertState(null)
  }, [])

  const handleBlockColorChange = useCallback((id: string, color: string) => {
    setCanvasBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, backgroundColor: color } : b)),
    )
  }, [])

  // Insert a block inline (from "+" button)
  const handleInlineInsert = useCallback((type: string, afterId: string | null) => {
    const newBlock: CanvasBlock = makeNewBlock(type)
    setCanvasBlocks((prev) => {
      if (afterId === null) return [newBlock, ...prev]
      const idx = prev.findIndex((b) => b.id === afterId)
      if (idx < 0) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setSelectedId(newBlock.id)
    setInsertState(null)
  }, [])

  // Insert after selected (or append) — used by Sections panel + right nav
  const handleAppendInsert = useCallback((type: string) => {
    const newBlock: CanvasBlock = makeNewBlock(type)
    setCanvasBlocks((prev) => {
      if (!selectedId) return [...prev, newBlock]
      const idx = prev.findIndex((b) => b.id === selectedId)
      if (idx < 0) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setSelectedId(newBlock.id)
    setInsertState(null)
  }, [selectedId])

  const handleTextClick = useCallback((_e: React.MouseEvent) => {
    // Do NOT call showAlly or set extra state here — any state update on click
    // triggers a re-render that resets dangerouslySetInnerHTML and moves the
    // cursor to position 0 before the browser finishes placing it.
    // Tab-switching is handled by handleTextFocus (onFocus), which fires after
    // the browser has already committed the cursor position.
    setShowTextEdit(true)
  }, [])

  const handleTextFocus = useCallback((key: string) => {
    setActiveTextKey(key)
    setFocusTab((prev) => ({ tab: 'font', seq: (prev?.seq ?? 0) + 1 }))
  }, [])

  const handleTextFieldChange = useCallback((blockId: string, key: string, html: string) => {
    setCanvasBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, texts: { ...(b.texts ?? {}), [key]: html } }
          : b,
      ),
    )
  }, [])

  // Clicking the styled button element inside a layout block → show Button tab
  const handleButtonAreaClick = useCallback(() => {
    setFocusTab((prev) => ({ tab: 'button', seq: (prev?.seq ?? 0) + 1 }))
  }, [])

  const handleCanvasClick = useCallback(() => {
    setSelectedId(null)
    setInsertState(null)
    setActiveTextKey(null)
    setShowTextEdit(false)
  }, [])

  const handleOpenImagePicker = useCallback((blockId: string, imageKey: string) => {
    setPendingImageTarget({ blockId, imageKey })
    setShowApprovedImages(true)
  }, [])

  const handleImageSelect = useCallback((src: string) => {
    if (pendingImageTarget) {
      const { blockId, imageKey } = pendingImageTarget
      setCanvasBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, imageSrcs: { ...(b.imageSrcs ?? {}), [imageKey]: src } }
            : b,
        ),
      )
    }
    // Always close — covers both "pick for block" and "browse from rail" modes
    setShowApprovedImages(false)
    setPendingImageTarget(null)
  }, [pendingImageTarget])

  const handleImageResize = useCallback((blockId: string, imageKey: string, height: number) => {
    setCanvasBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, imageSizes: { ...(b.imageSizes ?? {}), [imageKey]: height } }
          : b,
      ),
    )
  }, [])

  /** Direct upload from "My computer" in the Image tab — no ApprovedImagesPanel needed */
  const handleDirectImageUpload = useCallback(async (blockId: string, imageKey: string, src: string) => {
    // Optimistically store the base64 src while uploading
    setCanvasBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, imageSrcs: { ...(b.imageSrcs ?? {}), [imageKey]: src } }
          : b,
      ),
    )
    // Upload to Minio in the background and replace with durable URL
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: src }),
      })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        setCanvasBlocks((prev) =>
          prev.map((b) =>
            b.id === blockId
              ? { ...b, imageSrcs: { ...(b.imageSrcs ?? {}), [imageKey]: url } }
              : b,
          ),
        )
      }
    } catch {
      // keep base64 if upload fails
    }
  }, [])

  const handleBlockPatch = useCallback((id: string, patch: Partial<CanvasBlock>) => {
    setCanvasBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  const selectedBlock = canvasBlocks.find((b) => b.id === selectedId) ?? null

  return (
    <div className="absolute inset-0 flex overflow-hidden">

      {/* ── Icon Rail ────────────────────────────────────── */}
      <aside className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-gray-200 bg-white py-2 px-1">
        {RAIL_ITEMS.map((item) => (
          <RailBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id && panelOpen}
            onClick={() => handleTabClick(item.id)}
          />
        ))}

        {/* Divider */}
        <div className="my-1 w-7 border-t border-gray-200" />

        {/* Image Library shortcut */}
        <RailBtn
          icon={<ImageIcon size={14} />}
          label="Images"
          active={showApprovedImages && !pendingImageTarget}
          onClick={() => {
            setPendingImageTarget(null)
            setShowApprovedImages(true)
          }}
        />
      </aside>

      {/* ── Slide-out Sub-panel ──────────────────────────── */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200',
          panelOpen ? 'w-[216px]' : 'w-0 overflow-hidden',
        )}
      >
        {panelOpen && (
          <>
            {activeTab === 'tree'     && (
              <TreePanel
                blocks={canvasBlocks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'sections' && (
              <SectionsPanel
                onInsert={handleAppendInsert}
                onBlockDragStart={setDraggedBlockType}
                onBlockDragEnd={() => setDraggedBlockType(null)}
              />
            )}
            {activeTab === 'text'     && <TextBlocksPanel onInsert={handleAppendInsert} />}
            {activeTab === 'content'  && <ContentPanel selectedBlock={selectedBlock} onBlockColorChange={handleBlockColorChange} />}
            {activeTab === 'style'    && <StylePanel />}
          </>
        )}
      </aside>

      {/* ── Centre: Interactive Canvas ───────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-[#F3F4F6]">

        {/* Top toolbar strip */}
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">

          {/* ── Open existing emailer dropdown — far LEFT ── */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowEmailerDropdown((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <FolderOpen size={12} />
              Open
              <ChevronDownIcon size={10} className={cn('transition-transform', showEmailerDropdown && 'rotate-180')} />
            </button>

            {showEmailerDropdown && (
              <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-100 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Saved Emailers</p>
                </div>
                <div className="max-h-64 overflow-auto">
                  {savedEmailers.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[11px] text-gray-400">No saved emailers yet</p>
                  ) : (
                    savedEmailers.map((em) => (
                      <button
                        key={em.id}
                        onClick={() => handleLoadEmailer(em.id)}
                        className={cn(
                          'flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50',
                          em.id === currentEmailerId && 'bg-blue-50',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium leading-snug text-gray-800">{em.name}</p>
                          {em.subject && (
                            <p className="text-[10px] leading-snug text-gray-400">{em.subject}</p>
                          )}
                          <p className="text-[9px] text-gray-300">
                            {new Date(em.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        {em.id === currentEmailerId && <Check size={12} className="mt-0.5 shrink-0 text-blue-500" />}
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-gray-100 px-3 py-2">
                  <button
                    onClick={() => {
                      setShowEmailerDropdown(false)
                      setCanvasBlocks(makeDefaultBlocks())
                      setCurrentEmailerId(null)
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    <PlusCircle size={11} /> New emailer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Subject line — editable, centre fill */}
          <input
            type="text"
            value={doc.subject ?? ''}
            onChange={(e) => updateSubject(e.target.value)}
            placeholder="Add email subject line…"
            className="min-w-0 flex-1 bg-transparent text-center text-[11px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-0"
          />

          {/* ── Save / Save as New ── */}
          <div className="inline-flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                saveStatus === 'saved'
                  ? 'bg-green-50 text-green-600'
                  : saveStatus === 'error'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-gray-900 text-white hover:bg-gray-700',
              )}
            >
              {saveStatus === 'saving' ? (
                <Loader2 size={11} className="animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check size={11} />
              ) : (
                <Save size={11} />
              )}
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
            </button>

            {currentEmailerId && (
              <button
                onClick={() => {
                  setSaveModalMode('fork')
                  setEmailerNameInput((savedEmailers.find((e) => e.id === currentEmailerId)?.name ?? 'Untitled') + ' (copy)')
                  setShowSaveModal(true)
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
                title="Save as new emailer"
              >
                <PlusCircle size={11} /> Save as New
              </button>
            )}
          </div>

          {/* ── Desktop / Mobile toggle ── */}
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Monitor size={12} /> Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Smartphone size={12} /> Mobile
            </button>
          </div>

          {/* ── HTML Preview toggle ── */}
          <button
            onClick={() => setShowPreview((v) => !v)}
            title={showPreview ? 'Back to editor' : 'Preview actual email HTML'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
              showPreview
                ? 'border-blue-400 bg-blue-50 text-blue-600'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {/* ── Save / Name modal ── */}
        {showSaveModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="w-80 rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="mb-1 text-[14px] font-semibold text-gray-900">
                {saveModalMode === 'fork' ? 'Save as New Emailer' : 'Name Your Emailer'}
              </h3>
              <p className="mb-4 text-[11px] text-gray-400">
                {saveModalMode === 'fork'
                  ? 'Creates a duplicate with a new name — the original is untouched.'
                  : 'Give this emailer a name so you can find it later.'}
              </p>
              <input
                autoFocus
                type="text"
                value={emailerNameInput}
                onChange={(e) => setEmailerNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm() }}
                placeholder="e.g. Summer Sale 2025"
                className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="rounded-lg px-3 py-2 text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfirm}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-[12px] font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  {saveModalMode === 'fork' ? 'Save Copy' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── HTML Preview iframe (replaces canvas when Preview is active) ── */}
        {showPreview && (
          <div className="flex flex-1 items-start justify-center overflow-auto bg-[#F3F4F6] py-8">
            <div
              className={cn(
                'overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/5',
                previewMode === 'mobile' ? 'w-[390px]' : 'w-[660px]',
              )}
            >
              {/* Browser chrome bar */}
              <div className="flex h-8 items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <div className="ml-2 flex-1 rounded-sm bg-white px-2 py-0.5 text-[9px] text-gray-300 text-center">
                  {previewMode === 'mobile' ? 'Email client — mobile' : 'Email client — desktop'}
                </div>
              </div>
              {previewSrcDoc ? (
                <iframe
                  title="Email HTML Preview"
                  srcDoc={previewSrcDoc}
                  className="w-full border-0 block"
                  style={{ minHeight: 600, height: 'auto' }}
                  onLoad={(e) => {
                    // Auto-size iframe to its content height
                    const iframe = e.currentTarget
                    try {
                      const h = iframe.contentDocument?.documentElement?.scrollHeight
                      if (h) iframe.style.height = `${h}px`
                    } catch { /* cross-origin guard */ }
                  }}
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-[12px] text-gray-400">
                  Compiling email…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable canvas */}
        <div
          className={cn(
            'flex flex-1 items-start justify-center overflow-auto py-8',
            showPreview && 'hidden',
          )}
          onClick={handleCanvasClick}
        >
          <div className="w-full max-w-[680px] px-4">

            {/* Empty state */}
            {canvasBlocks.length === 0 && (
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-24">
                <div className="text-center">
                  <p className="text-[13px] font-medium text-gray-400">Add a block from the right panel or Sections</p>
                  <p className="mt-1 text-[11px] text-gray-300">Your email will be built here</p>
                </div>
              </div>
            )}

            {/* Top inserter (before first block) */}
            {insertState?.afterId === null && (
              <BlockInserter
                onSelect={(t) => handleInlineInsert(t, null)}
                onClose={() => setInsertState(null)}
              />
            )}

            {canvasBlocks.map((block, i) => {
              const isSelected = selectedId === block.id
              const prevId = i === 0 ? null : canvasBlocks[i - 1].id

              return (
                <React.Fragment key={block.id}>
                  {/* Block row — extra right margin so the absolute action bar has room */}
                  <div
                    className="relative mb-1 mr-14"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* The block itself */}
                    <div
                      className={cn(
                        'cursor-pointer overflow-hidden rounded border-2 transition-all',
                        isSelected
                          ? 'border-blue-400 shadow-[0_0_0_3px_rgba(96,165,250,0.15)]'
                          : 'border-transparent hover:border-gray-200',
                      )}
                      onClick={() => {
                        setSelectedId(block.id)
                        setInsertState(null)
                      }}
                    >
                      <BlockContent
                        type={block.type}
                        backgroundColor={block.backgroundColor}
                        onTextClick={handleTextClick}
                        imageSrcs={block.imageSrcs}
                        imageSizes={block.imageSizes}
                        onImageDoubleClick={(key) => handleOpenImagePicker(block.id, key)}
                        onImageResize={(key, h) => handleImageResize(block.id, key, h)}
                        onImageClick={(e) => showAlly('image', e)}
                        buttonShapeVariant={block.buttonShapeVariant}
                        buttonFillColor={block.buttonFillColor}
                        buttonBorderColor={block.buttonBorderColor}
                        buttonPosition={block.buttonPosition}
                        buttonBorderWidth={block.buttonBorderWidth}
                        buttonWidth={block.buttonWidth}
                        buttonHeight={block.buttonHeight}
                        buttonFontFamily={block.buttonFontFamily}
                        fontFamily={block.fontFamily ?? doc.globalStyles.fontFamily}
                        fontSize={block.fontSize}
                        fontBold={block.fontBold}
                        fontWeight={block.fontWeight}
                        fontItalic={block.fontItalic}
                        fontUnderline={block.fontUnderline}
                        fontColor={block.fontColor}
                        textAlign={block.textAlign}
                        lineHeight={block.lineHeight}
                        letterSpacing={block.letterSpacing}
                        fontCase={block.fontCase}
                        imageShape={block.imageShape}
                        onButtonAreaClick={handleButtonAreaClick}
                        contentLayout={block.contentLayout}
                        onContentLayoutSelect={(layout) =>
                          handleBlockPatch(block.id, { contentLayout: (layout || undefined) as CanvasBlock['contentLayout'] })
                        }
                        spacerHeight={block.spacerHeight}
                        linkBarItems={block.linkBarItems}
                        footerLinks={block.footerLinks}
                        socialLinks={block.socialLinks}
                        socialIconStyle={block.socialIconStyle}
                        socialIconColor={block.socialIconColor}
                        socialIconSize={block.socialIconSize}
                        socialIconPosition={block.socialIconPosition}
                        socialIconSpacing={block.socialIconSpacing}
                        contentHeight={block.contentHeight}
                        contentButton={block.contentButton}
                        isDraggingButton={draggedBlockType === 'button'}
                        onDropButton={(pos) => handleBlockPatch(block.id, {
                          contentButton: { position: pos, label: 'Click Here' },
                        })}
                        onContentButtonRemove={() => handleBlockPatch(block.id, { contentButton: null })}
                        texts={block.texts}
                        textStyles={block.textStyles}
                        onTextChange={(key, html) => handleTextFieldChange(block.id, key, html)}
                        onTextFocus={handleTextFocus}
                      />
                    </div>

                    {/* ± Insert above (top center of outline) */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setInsertState({ afterId: prevId })
                        }}
                        className="absolute -top-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-md transition-transform hover:scale-110 hover:bg-blue-600"
                        title="Insert block above"
                      >
                        <Plus size={12} />
                      </button>
                    )}

                    {/* ± Insert below (bottom center of outline) */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setInsertState({ afterId: block.id })
                        }}
                        className="absolute -bottom-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-md transition-transform hover:scale-110 hover:bg-blue-600"
                        title="Insert block below"
                      >
                        <Plus size={12} />
                      </button>
                    )}

                    {/* Floating action bar — absolutely to the right, outside the block */}
                    {isSelected && (
                      <div className="absolute right-[-52px] top-2 z-30">
                        <FloatingActionBar
                          onMoveUp={() => handleMoveUp(block.id)}
                          onMoveDown={() => handleMoveDown(block.id)}
                          onDuplicate={() => handleDuplicate(block.id)}
                          onDelete={() => handleDelete(block.id)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Inline block inserter — shown after this block when triggered */}
                  {insertState?.afterId === block.id && (
                    <BlockInserter
                      onSelect={(t) => handleInlineInsert(t, block.id)}
                      onClose={() => setInsertState(null)}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Approved images overlay — opens when an image slot is double-clicked */}
        <ApprovedImagesPanel
          open={showApprovedImages}
          onClose={() => { setShowApprovedImages(false); setPendingImageTarget(null) }}
          onSelect={handleImageSelect}
        />

        {/* ── Persistent Allyvate trigger button (bottom-right of canvas) ── */}
        {!allyVisible && (
          <button
            type="button"
            onClick={(e) => showAlly('text', e)}
            title="Ask Allyvate"
            className="absolute bottom-6 right-6 z-[80] flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 hover:shadow-xl overflow-hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/allyvate-icon.svg" alt="Ask Allyvate" width={44} height={44} />
          </button>
        )}
      </div>

      {/* ── Right Nav: EmailRightNav (when block selected) → Block Library ─ */}
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-gray-200 bg-white">
        {selectedBlock ? (
          <EmailRightNav
            block={selectedBlock}
            onPatch={handleBlockPatch}
            onOpenImagePicker={handleOpenImagePicker}
            onImageUpload={handleDirectImageUpload}
            onBack={() => setSelectedId(null)}
            focusTab={focusTab}
            activeTextKey={activeTextKey ?? undefined}
          />
        ) : (
          <BlockLibrary
            selectedBlock={undefined}
            onBlockSelect={handleAppendInsert}
          />
        )}
      </aside>

      {/* ── Allyvate AI Assistant (pill → expanded card) ─────────────────── */}
      <AllyvateAssistant
        visible={allyVisible}
        context={allyContext}
        anchorX={allyAnchorX}
        anchorY={allyAnchorY}
        onClose={() => setAllyVisible(false)}
      />

    </div>
  )
}
