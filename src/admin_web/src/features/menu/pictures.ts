// The DTO's pictureUri carries a `?v=<filename>` cache-buster that changes on
// every upload — carry it over so replaced images actually refresh.
function pictureVersion(pictureUri: string | null | undefined): string {
  const query = pictureUri?.split('?')[1]
  return query ? `?${query}` : ''
}

export function itemPictureUrl(
  id: number | string | undefined,
  pictureUri?: string | null
): string {
  return `/api/catalog/items/${id}/pic${pictureVersion(pictureUri)}`
}
