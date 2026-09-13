import { toast } from '@/lib/toast'

export const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

/** The picked file, or null (with a toast) when it is over the limit. */
export function pickedReceipt(
  e: React.ChangeEvent<HTMLInputElement>,
  tooLarge: string
): File | null {
  const file = e.target.files?.[0] ?? null
  e.target.value = ''
  if (file && file.size > RECEIPT_MAX_BYTES) {
    toast.error(tooLarge)
    return null
  }
  return file
}
