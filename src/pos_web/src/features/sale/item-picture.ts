// Item pictures are served straight off the BFF route (anonymous endpoint),
// same URL shape client_web uses for its menu tiles.
export function itemPictureUrl(id: number | string | undefined): string {
  return `/api/catalog/items/${id}/pic`
}
