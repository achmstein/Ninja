// The DTO's pictureUri carries a `?v=<filename>` cache-buster that changes on
// every upload — carry it over so replaced images actually refresh.
function pictureVersion(pictureUri: string | null | undefined): string {
  const query = pictureUri?.split('?')[1]
  return query ? `?${query}` : ''
}

/**
 * A promotion's picture, on this site's own address as the items' are:
 * the pictureUri the catalog sends is absolute, built from the proxy's
 * headers, and does not reach the picture from here; and the gateway lets
 * it through only with an api-version, unlike the items'. With `width` (320,
 * 640 or 1280) the server's copy that wide.
 */
export function promotionPictureUrl(
  id: number | string,
  pictureUri?: string | null,
  width?: 320 | 640 | 1280
): string {
  // The gateway passes only the items' pictures without an api-version
  const query = new URLSearchParams(pictureVersion(pictureUri).slice(1))
  query.set('api-version', '1.0')
  if (width) query.set('w', String(width))
  return `/api/catalog/promotions/${id}/pic?${query}`
}

/**
 * The item's picture; with `width` (160, 320, 640 or 1280) the server's
 * copy that wide, so a list's thumbnail does not load the full photo.
 */
export function itemPictureUrl(
  id: number | string | undefined,
  pictureUri?: string | null,
  width?: 160 | 320 | 640 | 1280
): string {
  const version = pictureVersion(pictureUri)
  const sized = width ? `${version ? '&' : '?'}w=${width}` : ''
  return `/api/catalog/items/${id}/pic${version}${sized}`
}
