import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { type ReceiptProposal } from '@ninja/api/inventory'
import { useContentLanguages } from '@/lib/content-languages'
import { useT } from '@/lib/i18n'
import { downscaleImage, SCAN_MAX_BYTES } from '@/lib/image'
import { toast } from '@/lib/toast'
import { assistErrorMessage } from '@/features/assistant/assist/errors'
import { useAiAvailable } from '@/features/assistant/assist/use-ai-available'
import { scanReceiptMutation } from './api/mutations'

/**
 * Pick a photo, shrink it, send it, keep the proposal for the review
 * sheet. The assistant is hidden (`available === false`) once the server
 * says it is not configured.
 */
export function useReceiptScan() {
  const t = useT()
  const available = useAiAvailable()
  const [proposal, setProposal] = useState<ReceiptProposal | null>(null)

  const languages = useContentLanguages()
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
        body: { file: image, languages },
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
