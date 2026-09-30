// The DTO's pictureUri carries a `?v=<filename>` cache-buster that changes on
// every upload — carry it over so replaced images actually refresh.
function pictureVersion(pictureUri: string | null | undefined): string {
  const query = pictureUri?.split('?')[1]
  return query ? `?${query}` : ''
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
