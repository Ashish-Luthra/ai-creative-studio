import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

interface PublicImageRecord {
  id: string
  name: string
  category: string
  src: string
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])

const toTitleCase = (input: string) =>
  input
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public')
    const files = await readdir(publicDir, { withFileTypes: true })

    const data: PublicImageRecord[] = files
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((fileName) => ({
        id: `public-${fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: toTitleCase(fileName),
        category: 'Public Library',
        src: `/${fileName}`,
      }))

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Unable to load public images' }, { status: 500 })
  }
}
