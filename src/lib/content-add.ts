import { classifyPages } from './content-classify';
import { sha1 } from './content-crawl';
import { localizeFirstAvailable } from './content-image';
import { upsertItems } from './content-store';
import { CATEGORY_THUMBS, type ContentItem } from './content-types';

/** Classify one piece of acquired text and store it as a draft item. */
export async function addSingleItem(args: {
  domain: string;
  brandName: string;
  url: string;
  title: string;
  metaDescription: string;
  text: string;
  source: ContentItem['source'];
  addedBy: string;
  /**
   * Lead-image candidates found on the page, best first; the first one that
   * downloads wins. A single page gives no way to spot a site-wide social
   * card, so og:image leads here.
   */
  pageImageUrls?: string[];
}): Promise<ContentItem> {
  const [classified] = await classifyPages(args.brandName, args.domain, [
    {
      url: args.url,
      title: args.title,
      metaDescription: args.metaDescription,
      textSample: args.text.slice(0, 1_500),
    },
  ]);
  const now = new Date().toISOString();
  const category = args.source === 'upload' && classified.category === 'Webpage' ? 'PDF' : classified.category;
  const id = `c_${sha1(args.url).slice(0, 12)}`;
  const imageUrl = await localizeFirstAvailable(args.pageImageUrls ?? [], args.domain, id, args.url);
  const item: ContentItem = {
    id,
    url: args.url,
    title: classified.title || args.title,
    description: classified.description,
    category,
    referenceDescription: classified.referenceDescription,
    tags: classified.tags,
    status: 'draft',
    source: args.source,
    addedBy: args.addedBy,
    thumb: CATEGORY_THUMBS[category],
    imageUrl,
    excerpt: args.text.slice(0, 1_200),
    fullText: args.text.slice(0, 20_000),
    contentHash: sha1(args.text),
    lastmod: null,
    brainKoId: null,
    brainPushError: null,
    crawledAt: now,
    updatedAt: now,
  };
  await upsertItems(args.domain, [item]);
  return item;
}
