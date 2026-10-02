// The pages of a menu as the scan takes them: one image each, about 4 MP, so
// small print stays readable and every page is well under the scan's 5 MB. A
// PDF is drawn page by page (pdf.js, loaded only when a PDF is dropped); a
// phone photo is drawn down and turned upright. The admin's menu scan does the
// same (admin_web/src/lib/pdf-pages.ts and image.ts).

/** Pages per scan: the server's MenuScanner.MaxPages */
export const MENU_MAX_PAGES = 8
const MAX_PIXELS = 4_000_000
const JPEG_QUALITY = 0.85

export const MENU_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export const isPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
const isImage = (file: File) => /^image\/(jpeg|png|webp)$/.test(file.type)

async function toJpeg(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  return blob ? new File([blob], name, { type: 'image/jpeg' }) : null
}

/** A photo drawn down to about 4 MP and upright; the file itself when it cannot be drawn. */
async function downscale(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  try {
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)))
    if (scale === 1 && file.type === 'image/jpeg') return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return (await toJpeg(canvas, file.name.replace(/\.[^.]+$/, '') + '.jpg')) ?? file
  } finally {
    bitmap.close()
  }
}

/** The first pages of a PDF as images, and how many it has in all. */
async function pdfPages(file: File, room: number): Promise<{ pages: File[]; total: number }> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
  try {
    const doc = await task.promise
    const base = file.name.replace(/\.[^.]+$/, '')
    const pages: File[] = []
    for (let n = 1; n <= Math.min(doc.numPages, room); n++) {
      const page = await doc.getPage(n)
      const natural = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.sqrt(MAX_PIXELS / (natural.width * natural.height)) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvas, viewport }).promise
      page.cleanup()
      const image = await toJpeg(canvas, `${base}-${n}.jpg`)
      if (image) pages.push(image)
    }
    return { pages, total: doc.numPages }
  } finally {
    await task.destroy()
  }
}

/**
 * Dropped files as menu pages, in order, at most {@link MENU_MAX_PAGES}: how many
 * were left out past that, and which files were neither a photo nor a PDF.
 */
export async function menuPages(
  files: File[]
): Promise<{ pages: File[]; leftOut: number; rejected: string[]; inOrder: boolean }> {
  const pages: File[] = []
  const rejected: string[] = []
  let leftOut = 0
  for (const file of files) {
    const room = MENU_MAX_PAGES - pages.length
    if (isPdf(file)) {
      if (room <= 0) {
        leftOut++
        continue
      }
      const pdf = await pdfPages(file, room)
      pages.push(...pdf.pages)
      leftOut += pdf.total - pdf.pages.length
    } else if (isImage(file)) {
      if (room <= 0) leftOut++
      else pages.push(await downscale(file))
    } else {
      rejected.push(file.name)
    }
  }
  // One PDF's pages are in the menu's own order already; photos are put in it by the scan
  return { pages, leftOut, rejected, inOrder: files.length === 1 && isPdf(files[0]) }
}
