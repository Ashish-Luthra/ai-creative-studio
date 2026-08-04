/**
 * Shared image category constants.
 * Imported by both the client-side ApprovedImagesPanel and the server-side
 * /api/categorize-image route — must NOT have a 'use client' directive.
 */

export const IMAGE_CATEGORIES = [
  'Logo & Brand Marks',
  'Product Images',
  'Lifestyle & Campaign',
  'Backgrounds & Textures',
  'Icons & UI Elements',
  'Social Media Assets',
  'AI Generated',
  'Illustrations & Graphics',
  'Uncategorised',
] as const

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number]
