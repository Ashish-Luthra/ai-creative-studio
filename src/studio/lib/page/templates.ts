import { nanoid } from 'nanoid'
import type { PageDocument, PageMode } from '@studio/types/page'
import { makeDefaultBlock } from './pageStore'

export function createDefaultDocument(mode: PageMode): PageDocument {
  if (mode === 'case-study') {
    return {
      id: nanoid(),
      mode,
      title: 'Untitled Case Study',
      blocks: [
        makeDefaultBlock('page-hero'),
        makeDefaultBlock('page-executive-summary'),
        makeDefaultBlock('page-problem'),
        makeDefaultBlock('page-solution'),
        makeDefaultBlock('page-results'),
        makeDefaultBlock('page-quote'),
        makeDefaultBlock('page-cta'),
      ],
      globalStyles: {
        fontFamily: 'Inter, system-ui, sans-serif',
        primaryColor: '#2563EB',
        textColor: '#0F172A',
        bgColor: '#FFFFFF',
      },
    }
  }

  // landing-page default
  return {
    id: nanoid(),
    mode,
    title: 'Untitled Landing Page',
    blocks: [
      makeDefaultBlock('page-hero'),
      makeDefaultBlock('page-results'),
      makeDefaultBlock('page-quote'),
      makeDefaultBlock('page-cta'),
    ],
    globalStyles: {
      fontFamily: 'Inter, system-ui, sans-serif',
      primaryColor: '#2563EB',
      textColor: '#0F172A',
      bgColor: '#FFFFFF',
    },
  }
}
