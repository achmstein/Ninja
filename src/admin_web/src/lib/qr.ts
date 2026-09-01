/** Public origin the printed QR codes point at. Tables and rooms each get
 *  their own path; the customer apps parse both shapes host-strictly. */
const PUBLIC_ORIGIN = 'https://chillax.site'

export function tableQrUrl(tableId: number): string {
  return `${PUBLIC_ORIGIN}/table/${tableId}`
}

export function roomQrUrl(roomId: number): string {
  return `${PUBLIC_ORIGIN}/room/${roomId}`
}
