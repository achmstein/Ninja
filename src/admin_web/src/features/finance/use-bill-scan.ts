import { useMutation } from '@tanstack/react-query'
import { type BillProposal } from '@/api/finance'
import { scanBillMutation } from '@/api/finance/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { downscaleImage, SCAN_MAX_BYTES } from '@/lib/image'
import { toast } from '@/lib/toast'
import { assistErrorMessage, useAssistStore } from '@/features/assist/errors'

/**
 * The sparkle on a bill attached to an expense: shrink the photo, send it,
 * hand the proposal back to the form. The assistant is hidden
 * (`available === false`) once the server says it is not configured.
 */
export function useBillScan() {
  const t = useT()
  const available = useAssistStore((s) => !s.unavailable)

  const scan = useMutation({
    ...scanBillMutation(),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  /** The proposal, or null when the file was refused or the call failed (both toasted) */
  const scanFile = async (file: File): Promise<BillProposal | null> => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('scanImageOnly'))
      return null
    }
    const image = await downscaleImage(file)
    if (image.size > SCAN_MAX_BYTES) {
      toast.error(t('receiptTooLarge'))
      return null
    }
    try {
      return await scan.mutateAsync({
        body: { file: image },
        query: { 'api-version': API_VERSION },
      })
    } catch {
      return null
    }
  }

  return { available, scanFile, isScanning: scan.isPending }
}
