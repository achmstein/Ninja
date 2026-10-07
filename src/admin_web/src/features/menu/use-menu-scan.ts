import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { type MenuProposal } from '@/api/catalog'
import { scanMenuMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useContentLanguages } from '@/lib/content-languages'
import { useT } from '@/lib/i18n'
import { downscaleImage, SCAN_MAX_BYTES } from '@/lib/image'
import { isPdf, pdfToImages } from '@/lib/pdf-pages'
import { toast } from '@/lib/toast'
import { assistErrorMessage } from '@/features/assist/errors'
import { useAiAvailable } from '@/features/assist/use-ai-available'

/** Pages per scan, the server's own cap (MenuScanner.MaxPages) */
export const MENU_SCAN_MAX_PAGES = 8

/**
 * Pick the menu's pages — photos, a PDF, or both — shrink them, send them
 * in one scan, keep the proposal for the review sheet. The assistant is
 * hidden (`available === false`) once the server says it is not configured.
 */
export function useMenuScan() {
  const t = useT()
  const available = useAiAvailable()
  const [proposal, setProposal] = useState<MenuProposal | null>(null)
  const [preparing, setPreparing] = useState(false)

  const languages = useContentLanguages()
  const scan = useMutation({
    ...scanMenuMutation(),
    onSuccess: (data) => setProposal(data),
    onError: (error) => toast.error(assistErrorMessage(error)),
  })

  const pagesOf = async (files: File[]): Promise<File[] | null> => {
    const pages: File[] = []
    let leftOut = 0
    for (const file of files) {
      const room = MENU_SCAN_MAX_PAGES - pages.length
      if (isPdf(file)) {
        if (room <= 0) {
          leftOut++
          continue
        }
        try {
          const pdf = await pdfToImages(file, room)
          pages.push(...pdf.pages)
          leftOut += pdf.total - pdf.pages.length
        } catch {
          toast.error(t('pdfUnreadable'))
          return null
        }
        continue
      }
      if (!file.type.startsWith('image/')) {
        toast.error(t('scanImageOnly'))
        return null
      }
      if (room <= 0) {
        leftOut++
        continue
      }
      const image = await downscaleImage(file)
      if (image.size > SCAN_MAX_BYTES) {
        toast.error(t('receiptTooLarge'))
        return null
      }
      pages.push(image)
    }
    if (leftOut > 0)
      toast.warning(
        t('menuPagesLeftOut', { max: MENU_SCAN_MAX_PAGES, count: leftOut })
      )
    return pages
  }

  const scanFiles = async (files: File[]) => {
    if (files.length === 0) return
    setPreparing(true)
    let pages: File[] | null
    try {
      pages = await pagesOf(files)
    } finally {
      setPreparing(false)
    }
    if (!pages || pages.length === 0) return
    try {
      await scan.mutateAsync({
        // One PDF's pages are in the menu's own order; photos are put in it first
        body: {
          files: pages,
          languages,
          inOrder: files.length === 1 && isPdf(files[0]),
        },
        query: { 'api-version': API_VERSION },
      })
    } catch {
      // toasted above
    }
  }

  return {
    available,
    scanFiles,
    isScanning: preparing || scan.isPending,
    proposal,
    clearProposal: () => setProposal(null),
  }
}
