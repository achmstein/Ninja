/** Public origin the printed QR codes point at. Rooms use the same host with a
 *  /room/{id} path; the customer apps parse both shapes host-strictly. */
const PUBLIC_ORIGIN = 'https://chillax.site'

export function tableQrUrl(tableId: number): string {
  return `${PUBLIC_ORIGIN}/table/${tableId}`
}
