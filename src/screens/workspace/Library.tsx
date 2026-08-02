import { useMemo, useState } from 'react';
import {
  Search,
  Upload,
  Globe,
  FileText,
  Image as ImageIcon,
  Shapes,
  Hexagon,
  ListFilter,
  Lightbulb,
  ShieldCheck,
  ClipboardList,
  BarChart3,
  Sparkles,
  Layers,
} from 'lucide-react';

/**
 * Content Library (dummy data): everything ingested from the customer's website —
 * blogs, case studies, whitepapers, images, icons, logos. This corpus feeds
 * (1) SalesAgent training, (2) tone-of-voice extraction, (3) LP / emailer /
 * LinkedIn ad generation, and (4) the Asset Library. Real ingestion will
 * replace MOCK_LIBRARY with a crawl of the workspace's domain.
 */

type ContentType = 'Webpage' | 'PDF' | 'Image' | 'Icon set' | 'Logo';

interface LibraryItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  addedBy: string;
  modified: string;
  type: ContentType;
  thumb: { bg: string; fg: string; label: string; icon: 'bulb' | 'shield' | 'clipboard' | 'chart' | 'sparkles' | 'layers' | 'image' | 'shapes' | 'hexagon' };
}

const MOCK_LIBRARY: LibraryItem[] = [
  {
    id: 'c1',
    title: 'Introducing enterprise-ready capabilities for AI sales agents',
    description: 'Our new enterprise-ready capabilities include SSO, audit logs and workspace-level governance.',
    tags: ['page-type:blog', 'funnel-stage:consideration'],
    addedBy: 'Allyvate Team',
    modified: '2d ago',
    type: 'Webpage',
    thumb: { bg: '#F3E8FF', fg: '#5B2D8E', label: 'NEW', icon: 'bulb' },
  },
  {
    id: 'c2',
    title: 'The Sales Discovery Playbook Template',
    description: "Download Allyvate's customizable discovery playbook for enterprise sales teams.",
    tags: ['page-type:resources', 'funnel-stage:consideration'],
    addedBy: 'Allyvate Team',
    modified: '2d ago',
    type: 'PDF',
    thumb: { bg: '#FCE7F3', fg: '#9D174D', label: 'TEMPLATE', icon: 'clipboard' },
  },
  {
    id: 'c3',
    title: 'How revenue leaders can safely adopt agentic AI',
    description: 'Agentic AI must be grounded in strong governance — here is the framework we use.',
    tags: ['page-type:blog', 'funnel-stage:consideration'],
    addedBy: 'Allyvate Team',
    modified: '2d ago',
    type: 'Webpage',
    thumb: { bg: '#1E1B4B', fg: '#C4B5FD', label: '', icon: 'shield' },
  },
  {
    id: 'c4',
    title: 'Case Study: Wavelet lifts demo-to-close 38% with Allyvate',
    description: 'How Wavelet deployed the SalesDemo Agent across three product lines in six weeks.',
    tags: ['page-type:case-study', 'funnel-stage:decision'],
    addedBy: 'Allyvate Team',
    modified: '3d ago',
    type: 'Webpage',
    thumb: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'CASE STUDY', icon: 'chart' },
  },
  {
    id: 'c5',
    title: 'A checklist for BFSI sales compliance',
    description: 'A guide on how to achieve and maintain compliant AI-assisted selling in regulated industries.',
    tags: ['page-type:resources', 'funnel-stage:consideration'],
    addedBy: 'Allyvate Team',
    modified: '4d ago',
    type: 'PDF',
    thumb: { bg: '#EDE9FE', fg: '#4C1D95', label: 'CHECKLIST', icon: 'clipboard' },
  },
  {
    id: 'c6',
    title: 'Whitepaper: The Organisation Brain architecture',
    description: 'Why a single retrieval brain beats per-team knowledge silos — data included.',
    tags: ['page-type:whitepaper', 'funnel-stage:awareness'],
    addedBy: 'Allyvate Team',
    modified: '5d ago',
    type: 'PDF',
    thumb: { bg: '#FEF3C7', fg: '#92400E', label: 'WHITEPAPER', icon: 'layers' },
  },
  {
    id: 'c7',
    title: 'Allyvate success stories in healthcare compliance',
    description: 'Find out how Allyvate helps growing healthcare companies automate compliant outreach.',
    tags: ['page-type:resources', 'funnel-stage:decision'],
    addedBy: 'Allyvate Team',
    modified: '5d ago',
    type: 'Webpage',
    thumb: { bg: '#FEF9C3', fg: '#854D0E', label: 'STORIES', icon: 'sparkles' },
  },
  {
    id: 'c8',
    title: '[Template] AI Security Assessment',
    description: 'Evaluate AI security risks with confidence using our vendor-agnostic assessment.',
    tags: ['page-type:product', 'funnel-stage:consideration'],
    addedBy: 'Allyvate Team',
    modified: '6d ago',
    type: 'PDF',
    thumb: { bg: '#EDE9FE', fg: '#5B21B6', label: 'TEMPLATE', icon: 'shield' },
  },
  {
    id: 'c9',
    title: 'Homepage hero + product screenshots (12 images)',
    description: 'All raster imagery scraped from allyvate.ai — hero art, dashboards, feature sections.',
    tags: ['asset:images', 'source:website'],
    addedBy: 'Website ingest',
    modified: '1d ago',
    type: 'Image',
    thumb: { bg: '#E0F2FE', fg: '#0369A1', label: '12', icon: 'image' },
  },
  {
    id: 'c10',
    title: 'Product icon set (28 SVGs)',
    description: 'Feature and navigation icons extracted from the website and design system.',
    tags: ['asset:icons', 'source:website'],
    addedBy: 'Website ingest',
    modified: '1d ago',
    type: 'Icon set',
    thumb: { bg: '#DCFCE7', fg: '#166534', label: '28', icon: 'shapes' },
  },
  {
    id: 'c11',
    title: 'Logo pack — primary, mono, favicon (6 files)',
    description: 'Wordmark and cube mark in dark/light/mono variants, plus favicons.',
    tags: ['asset:logos', 'source:website'],
    addedBy: 'Website ingest',
    modified: '1d ago',
    type: 'Logo',
    thumb: { bg: '#0D1B2A', fg: '#E2E8F0', label: '', icon: 'hexagon' },
  },
  {
    id: 'c12',
    title: 'Pricing page copy',
    description: 'Full pricing-page copy captured for tone-of-voice extraction and ad variants.',
    tags: ['page-type:product', 'funnel-stage:decision'],
    addedBy: 'Website ingest',
    modified: '1d ago',
    type: 'Webpage',
    thumb: { bg: '#FFE4E6', fg: '#9F1239', label: 'PRICING', icon: 'chart' },
  },
];

const TYPE_ICON: Record<ContentType, typeof Globe> = {
  Webpage: Globe,
  PDF: FileText,
  Image: ImageIcon,
  'Icon set': Shapes,
  Logo: Hexagon,
};

const THUMB_ICON = {
  bulb: Lightbulb,
  shield: ShieldCheck,
  clipboard: ClipboardList,
  chart: BarChart3,
  sparkles: Sparkles,
  layers: Layers,
  image: ImageIcon,
  shapes: Shapes,
  hexagon: Hexagon,
} as const;

function Thumb({ thumb }: { thumb: LibraryItem['thumb'] }) {
  const Icon = THUMB_ICON[thumb.icon];
  return (
    <div
      className="w-[104px] h-[68px] rounded-lg flex-shrink-0 flex flex-col items-center justify-center gap-1 border border-black/5"
      style={{ background: thumb.bg }}
    >
      <Icon size={22} color={thumb.fg} strokeWidth={1.8} />
      {thumb.label && (
        <span className="text-[7px] font-bold tracking-[0.8px]" style={{ color: thumb.fg }}>
          {thumb.label}
        </span>
      )}
    </div>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-block px-2 py-[3px] rounded-md text-[10px] font-medium bg-[#F5E9F7] text-[#7E22CE]">
      {tag}
    </span>
  );
}

export function Library() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | ContentType>('All');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_LIBRARY.filter((item) => {
      if (typeFilter !== 'All' && item.type !== typeFilter) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    });
  }, [query, typeFilter]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
        <h1 className="text-[20px] font-bold text-[#0d1117]">Library</h1>
        <button
          type="button"
          className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white bg-[#1E1B4B] hover:opacity-90 flex items-center gap-2"
        >
          <Upload size={14} /> Add content
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center justify-between px-6 pb-3 flex-shrink-0 gap-3">
        <div className="relative flex-1 max-w-[520px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or description..."
            className="w-full h-9 rounded-lg border border-[#e5e7eb] pl-8 pr-3 text-[13px] outline-none focus:border-[#2563EB] placeholder:text-[#9CA3AF]"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'All' | ContentType)}
            className="h-9 rounded-lg border border-[#e5e7eb] px-2.5 text-[13px] text-[#374151] outline-none bg-white cursor-pointer"
            aria-label="Filter by content type"
          >
            {(['All', 'Webpage', 'PDF', 'Image', 'Icon set', 'Logo'] as const).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-[#e5e7eb] text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] flex items-center gap-1.5"
          >
            <ListFilter size={13} /> Tags
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] font-semibold text-[#6b7280] border-b border-[#e5e7eb]">
              <th className="py-2.5 pr-4 font-semibold w-[120px]">Preview</th>
              <th className="py-2.5 pr-4 font-semibold">Title</th>
              <th className="py-2.5 pr-4 font-semibold w-[130px]">Added by</th>
              <th className="py-2.5 pr-4 font-semibold w-[110px]">Last modified</th>
              <th className="py-2.5 font-semibold w-[130px]">Content type</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const TypeIcon = TYPE_ICON[item.type];
              return (
                <tr key={item.id} className="border-b border-[#f1f2f4] hover:bg-[#fafafa] cursor-pointer align-middle">
                  <td className="py-3 pr-4"><Thumb thumb={item.thumb} /></td>
                  <td className="py-3 pr-4">
                    <div className="text-[13px] font-semibold text-[#0d1117] leading-snug max-w-[420px] truncate">{item.title}</div>
                    <div className="text-[12px] text-[#6b7280] mt-0.5 max-w-[420px] truncate">{item.description}</div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {item.tags.map((tag) => <TagPill key={tag} tag={tag} />)}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-[12px] text-[#374151]">{item.addedBy}</td>
                  <td className="py-3 pr-4 text-[12px] text-[#6b7280]">{item.modified}</td>
                  <td className="py-3">
                    <span className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                      <TypeIcon size={14} className="text-[#6b7280]" /> {item.type}
                    </span>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[13px] text-[#9CA3AF]">
                  No content matches your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
