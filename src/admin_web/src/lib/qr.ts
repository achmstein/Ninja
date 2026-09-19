/** The URL a printed QR code carries. Every place — room, table or station —
 *  gets the same /p/{id} path on the tenant's customer origin (the brand's
 *  customerUrl, else the platform's default for this admin host); the
 *  customer apps parse it host-strictly. */
export function placeQrUrl(origin: string, placeId: number): string {
  return `${origin}/p/${placeId}`
}
