// A phone photo is 3–8 MB and 12 MP; a model reads a receipt or a menu just
// as well at about 4 MP and the upload is several times smaller. The cap is
// on the pixels, not the longest side: a long thermal receipt or a tall
// menu keeps its width, so its small print stays readable.
// Anything that fails (an old browser, an odd format) falls back to the
// original file, which the server still accepts up to its own cap.

export const MAX_PIXELS = 4_000_000
const JPEG_QUALITY = 0.85

/** What the assistant's scan endpoints take, and the server's cap on it */
export const SCAN_ACCEPT = 'image/jpeg,image/png,image/webp'

/** A menu's pages arrive as photos or as a PDF */
export const MENU_SCAN_ACCEPT = SCAN_ACCEPT + ',application/pdf'
export const SCAN_MAX_BYTES = 5 * 1024 * 1024

export async function downscaleImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file

  let bitmap: ImageBitmap
  try {
    // from-image: apply the EXIF rotation so a portrait receipt stays upright
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const scale = Math.min(
      1,
      Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height))
    )
    if (scale === 1 && file.type === 'image/jpeg') return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    bitmap.close()
  }
}
