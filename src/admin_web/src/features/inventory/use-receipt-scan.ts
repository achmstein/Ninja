import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { type ReceiptProposal } from '@/api/inventory'
import { scanReceiptMutation } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { downscaleImage } from '@/lib/image'
import { toast } from '@/lib/toast'
import { assistErrorMessage, useAssistStore } from '@/features/assist/errors'
import { SCAN_MAX_BYTES } from './receipt-scan'

/**
 * Pick a photo, shrink it, send it, keep the proposal for the review
 * sheet. The assistant is hidden (`available === false`) once the server
 * says it is not configured.
 */
export function useReceiptScan() {
  const t = useT()
  const available = useAssistStore((s) => !s.unavailable)
  const [proposal, setProposal] = useState<ReceiptProposal | null>(null)

  const scan = useMutation({
    ...scanReceiptMutation(),
    onSuccess: (data) => setProposal(data),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  const scanFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('scanImageOnly'))
      return
    }
    const image = await downscaleImage(file)
    if (image.size > SCAN_MAX_BYTES) {
      toast.error(t('receiptTooLarge'))
      return
    }
    try {
      await scan.mutateAsync({
        body: { file: image },
        query: { 'api-version': API_VERSION },
      })
    } catch {
      // toasted above
    }
  }

  return {
    available,
    scanFile,
    isScanning: scan.isPending,
    proposal,
    clearProposal: () => setProposal(null),
  }
}
