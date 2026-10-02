/** The widths the catalog cuts a dish photo to; anything else is the photo itself */
export type PictureWidth = 160 | 320 | 640 | 1280

type Pictured = {
  id?: number | string | null
  pictureUri?: string | null
}

/**
 * A dish photo at a width that fits where it is drawn, carrying the photo's
 * version (from its pictureUri) so the address changes when the photo does
 * and the browser may keep it for good. Without a width it is the full photo.
 *
 * - 320: a thumbnail (a face in a row, the cart, a pairing card)
 * - 640: a tile, and anything a tile flies into, so the flight's copy is already loaded
 * - 1280: a full-screen card on a sharp phone, through srcset
 */
export function itemPictureUrl(item: Pictured, width?: PictureWidth): string {
  const query = new URLSearchParams()
  const version = versionOf(item.pictureUri)
  if (version) query.set('v', version)
  if (width) query.set('w', String(width))
  const qs = query.toString()
  return `/api/catalog/items/${item.id}/pic${qs ? `?${qs}` : ''}`
}

/** A full-width photo's choices, for srcset with sizes='100vw' */
export function itemPictureSrcSet(item: Pictured): string {
  return ([640, 1280] as const).map((w) => `${itemPictureUrl(item, w)} ${w}w`).join(', ')
}

function versionOf(pictureUri: string | null | undefined): string | null {
  if (!pictureUri) return null
  try {
    return new URL(pictureUri, 'http://local').searchParams.get('v')
  } catch {
    return null
  }
}
