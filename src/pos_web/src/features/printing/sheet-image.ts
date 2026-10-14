import { getFontEmbedCSS, toPng } from 'html-to-image'

/** A roll's printable width at 203 dpi (72 mm): the dots the connector prints */
export const PRINT_DOTS = 576

/**
 * The print stylesheet's look for a .receipt-sheet (styles/index.css), put
 * on a copy that stays on screen long enough to be drawn: the sheet itself
 * is display:none outside print.
 */
const SHEET_STYLE: Record<string, string> = {
  display: 'block',
  width: '72mm',
  margin: '0',
  padding: '4mm 0 8mm',
  color: '#000',
  background: '#fff',
  'font-family': "'Inter', 'Alexandria', system-ui, sans-serif",
  'font-size': '12px',
  'line-height': '1.4',
}

// The page's fonts, inlined once: every sheet after the first reuses them.
// Only a success is kept — a till that first printed offline tries again.
let fontCss: string | null = null

async function imagesLoaded(node: HTMLElement) {
  await Promise.all(
    Array.from(node.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  )
}

/**
 * A picture of one sheet as the roll would print it, as base64 PNG (no
 * data: prefix), PRINT_DOTS wide. The browser draws the text, so Arabic
 * comes out shaped and right to left exactly as on the screen.
 */
/** A transparent 1×1 GIF: paper, where a picture would have been */
const BLANK_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export async function sheetImage(sheet: HTMLElement): Promise<string> {
  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;'
  const copy = sheet.cloneNode(true) as HTMLElement
  for (const [property, value] of Object.entries(SHEET_STYLE)) {
    copy.style.setProperty(property, value, 'important')
  }
  // A page break means nothing on a picture
  copy.style.removeProperty('break-before')
  copy.style.removeProperty('page-break-before')
  holder.appendChild(copy)
  document.body.appendChild(holder)
  try {
    await imagesLoaded(copy)
    const fonts = fontCss ?? (await getFontEmbedCSS(copy).catch(() => null))
    if (fonts) fontCss = fonts
    const url = await toPng(copy, {
      pixelRatio: PRINT_DOTS / copy.offsetWidth,
      backgroundColor: '#fff',
      // No fonts to inline (offline, first print): the system's own draw it
      fontEmbedCSS: fonts ?? '',
      cacheBust: false,
      // A picture it cannot fetch (the logo, offline and never cached) is
      // left blank rather than failing the receipt it sits on
      imagePlaceholder: BLANK_PIXEL,
    })
    return url.slice(url.indexOf(',') + 1)
  } finally {
    holder.remove()
  }
}
