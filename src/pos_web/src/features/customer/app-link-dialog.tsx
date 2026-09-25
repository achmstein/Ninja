import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Copy, MessageCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrand, useBrandName, useCustomerOrigin } from '@/lib/brand'
import { useLocale, useT } from '@/lib/i18n'
import { whatsAppLink } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { claimUrl, issueClaimLink } from './counter-customers'

type AppLinkDialogProps = {
  customer: { id: string; name: string; phone?: string | null } | null
  onOpenChange: (open: boolean) => void
}

/**
 * The one-time link that hands a counter customer their account: a QR the
 * customer scans at the counter with their own phone, or the same link on
 * WhatsApp. Every opening asks Identity for a fresh link, which replaces
 * the last one; it works once, for half an hour.
 */
export function AppLinkDialog({ customer, onOpenChange }: AppLinkDialogProps) {
  const t = useT()
  const locale = useLocale()
  const origin = useCustomerOrigin()
  const cafe = useBrandName()
  const country = useBrand()?.locale.country ?? 'EG'
  const [link, setLink] = useState<{ url: string; expiresAt: Date } | null>(null)

  const issue = useMutation({
    mutationFn: (id: string) => issueClaimLink(id),
    onSuccess: (claim) =>
      setLink({ url: claimUrl(origin, claim.token), expiresAt: new Date(claim.expiresAt) }),
  })

  const customerId = customer?.id
  const { mutate, reset } = issue
  useEffect(() => {
    setLink(null)
    reset()
    if (customerId) mutate(customerId)
  }, [customerId, mutate, reset])

  const failure =
    issue.error instanceof AxiosError
      ? issue.error.response?.status === 409
        ? t('alreadyHasAccount')
        : issue.error.response?.status === 429
          ? t('tooManyLinks')
          : t('somethingWentWrong')
      : issue.error
        ? t('somethingWentWrong')
        : null

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('somethingWentWrong'))
    }
  }

  const message = link
    ? t('appLinkMessage', { name: customer?.name ?? '', cafe, url: link.url })
    : ''

  return (
    <Dialog open={customer !== null} onOpenChange={onOpenChange}>
      <DialogContent className='flex flex-col items-center gap-4 sm:max-w-sm'>
        <DialogHeader className='w-full'>
          <DialogTitle className='text-xl'>
            {t('appLinkTitle', { name: customer?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('appLinkHint')}</DialogDescription>
        </DialogHeader>

        {failure ? (
          <div className='flex w-full flex-col items-center gap-3 py-6 text-center'>
            <p className='text-muted-foreground text-sm'>{failure}</p>
            {customerId && (
              <Button variant='outline' onClick={() => mutate(customerId)}>
                {t('retry')}
              </Button>
            )}
          </div>
        ) : !link ? (
          <Skeleton className='size-60 rounded-xl' />
        ) : (
          <>
            {/* White behind the code whatever the theme: phones read dark-on-light */}
            <div className='rounded-xl bg-white p-4'>
              <QRCodeSVG value={link.url} size={224} level='M' marginSize={0} />
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('appLinkUntil', {
                time: link.expiresAt.toLocaleTimeString(locale, {
                  hour: 'numeric',
                  minute: '2-digit',
                }),
              })}
            </p>
            <div className='grid w-full grid-cols-2 gap-2'>
              {customer?.phone ? (
                <Button asChild className='h-12 gap-2'>
                  <a href={whatsAppLink(customer.phone, message, country)} target='_blank' rel='noreferrer'>
                    <MessageCircle className='size-4' />
                    {t('sendOnWhatsApp')}
                  </a>
                </Button>
              ) : (
                <span />
              )}
              <Button variant='outline' className='h-12 gap-2' onClick={copy}>
                <Copy className='size-4' />
                {t('copyLink')}
              </Button>
            </div>
          </>
        )}

        <Button variant='outline' size='lg' className='h-12 w-full' onClick={() => onOpenChange(false)}>
          {t('done')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
