export function itemPictureUrl(id: number | string | undefined): string {
  return `/api/catalog/items/${id}/pic`
}
