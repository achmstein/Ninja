import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { type MenuProposal } from '@/api/catalog'
import { scanMenuMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { downscaleImage, SCAN_MAX_BYTES } from '@/lib/image'
import { toast } from '@/lib/toast'
import { assistErrorMessage, useAssistStore } from '@/features/assist/errors'

/**
 * Pick a photo of a menu, shrink it, send it, keep the proposal for the
 * review sheet. The assistant is hidden (`available === false`) once the
 * server says it is not configured.
 */
export function useMenuScan() {
  const t = useT()
  const available = useAssistStore((s) => !s.unavailable)
  const [proposal, setProposal] = useState<MenuProposal | null>(null)

  const scan = useMutation({
    ...scanMenuMutation(),
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
