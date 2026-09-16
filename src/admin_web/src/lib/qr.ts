/** Public origin the printed QR codes point at. Every place — room, table
 *  or station — gets the same /p/{id} path; the customer apps parse it
 *  host-strictly. */
const PUBLIC_ORIGIN = 'https://chillax.site'

export function placeQrUrl(placeId: number): string {
  return `${PUBLIC_ORIGIN}/p/${placeId}`
}
