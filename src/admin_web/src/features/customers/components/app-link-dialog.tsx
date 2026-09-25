import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Copy, MessageCircle, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBrand, useBrandName, useCustomerOrigin } from '@/lib/brand'
import { useLocale, useT } from '@/lib/i18n'
import { whatsAppLink } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import {
  claimUrl,
  counterCustomersService,
} from '../services/counter-customers-service'
import { getCustomerDisplayName, type Customer } from '../types'

type AppLinkDialogProps = {
  customer: Customer
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A one-time link for a customer added at the counter, as a QR to scan
 * from this screen or a message to send: they set an email and a password
 * and the account — points, tab, orders — is theirs. A new link each time
 * the dialog opens; the last one stops working.
 */
export function AppLinkDialog({
  customer,
  open,
  onOpenChange,
}: AppLinkDialogProps) {
  const t = useT()
  const locale = useLocale()
  const origin = useCustomerOrigin()
  const cafe = useBrandName()
  const country = useBrand()?.locale?.country ?? 'EG'
  const name = getCustomerDisplayName(customer)

  const issue = useMutation({
    mutationFn: () => counterCustomersService.claimLink(customer.id),
  })
  const { mutate, reset } = issue
  useEffect(() => {
    if (open) mutate()
    else reset()
  }, [open, mutate, reset])

  const url = issue.data ? claimUrl(origin, issue.data.token) : ''
  const until = issue.data
    ? new Date(issue.data.expiresAt).toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''
  const message = t('appLinkMessage', { name, cafe, url })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('copiedToClipboard'))
    } catch {
      toast.error(t('somethingWentWrong'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('appLinkTitle', { name })}</DialogTitle>
          <DialogDescription>{t('appLinkHint')}</DialogDescription>
        </DialogHeader>

        {issue.isError ? (
          <ErrorState error={issue.error} onRetry={() => issue.mutate()} />
        ) : !issue.data ? (
          <Skeleton className='mx-auto size-[232px] rounded-xl' />
        ) : (
          <div className='flex flex-col items-center gap-3'>
            <div className='rounded-xl border bg-white p-3'>
              <QRCodeSVG
                value={url}
                size={208}
                level='M'
                marginSize={1}
                bgColor='#ffffff'
                fgColor='#000000'
              />
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('appLinkUntil', { time: until })}
            </p>
            <div className='flex w-full flex-col gap-2'>
              {customer.phoneNumber && (
                <Button asChild>
                  <a
                    href={whatsAppLink(customer.phoneNumber, country, message)}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <MessageCircle />
                    {t('sendOnWhatsApp')}
                  </a>
                </Button>
              )}
              <div className='flex gap-2'>
                <Button variant='outline' className='flex-1' onClick={copy}>
                  <Copy />
                  {t('copyLink')}
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={t('sendAppLink')}
                  onClick={() => issue.mutate()}
                  disabled={issue.isPending}
                >
                  <RefreshCw />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
