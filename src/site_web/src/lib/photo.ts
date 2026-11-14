// A menu photo made light before it is sent: a phone's 12 MP shot drawn down
// to about 3 MP as a JPEG, upright. Small print stays readable, the upload is
// around a megabyte, and it is well under what the control plane takes.

const MAX_PIXELS = 3_000_000
const QUALITY = 0.82

/** How many photos one request carries: the control plane's LeadMaxPhotos */
export const MAX_PHOTOS = 4

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp'

/** The photo drawn down; the file itself when the browser cannot draw it. */
export async function lighten(file: File): Promise<File> {
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } finally {
    bitmap.close()
  }
}
