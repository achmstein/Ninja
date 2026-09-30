import { MAX_PIXELS } from './image'

// A PDF menu becomes one JPEG per page, the way a photo of each page would
// arrive: about 4 MP each, so small print stays readable and every page is
// well under the scan's 5 MB. pdf.js is loaded only when a PDF is picked.

const JPEG_QUALITY = 0.85

export function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

/**
 * The first `maxPages` pages as images, and how many pages the PDF has in
 * all (so the caller can say the rest were left out).
 */
export async function pdfToImages(
  file: File,
  maxPages: number
): Promise<{ pages: File[]; total: number }> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() })
  try {
    const doc = await task.promise
    const base = file.name.replace(/\.[^.]+$/, '')
    const pages: File[] = []
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const page = await doc.getPage(n)
      const natural = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({
        scale: Math.sqrt(MAX_PIXELS / (natural.width * natural.height)),
      })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvas, viewport }).promise
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
      )
      page.cleanup()
      if (blob)
        pages.push(new File([blob], `${base}-${n}.jpg`, { type: 'image/jpeg' }))
    }
    return { pages, total: doc.numPages }
  } finally {
    await task.destroy()
  }
}
