import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { getTransferOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuantity } from '../format'

type TransferSheetProps = {
  transferId: number | null
  /** Display name for a branch id, from the public branch list */
  branchName: (id: number | string) => string
  onOpenChange: (open: boolean) => void
}

/** One transfer, read-only: which way it went, who sent it, what was in it. */
export function TransferSheet({
  transferId,
  branchName,
  onOpenChange,
}: TransferSheetProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const { data: transfer, isLoading } = useQuery({
    ...getTransferOptions({
      path: { id: transferId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: transferId != null,
  })

  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <Sheet open={transferId != null} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>
            {t('transferHash', { id: toNumber(transfer?.id ?? transferId) })}
          </SheetTitle>
          <SheetDescription>
            {transfer
              ? `${dateTime.format(new Date(transfer.sentAt))} · ${transfer.sentBy}`
              : ' '}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 px-4 pb-4'>
          {isLoading || !transfer ? (
            <div className='space-y-3'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-12' />
              ))}
            </div>
          ) : (
            <>
              <div className='mb-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium'>
                {branchName(transfer.fromBranchId)}
                <ArrowRight className='text-muted-foreground h-3.5 w-3.5 shrink-0 rtl:rotate-180' />
                {branchName(transfer.toBranchId)}
              </div>
              {transfer.note && (
                <p className='text-muted-foreground mb-3 text-sm'>
                  {transfer.note}
                </p>
              )}
              <div className='divide-y'>
                {transfer.lines.map((line, index) => (
                  <div
                    key={`${line.stockItemId}-${index}`}
                    className='flex items-center gap-3 py-2'
                  >
                    <div className='min-w-0 flex-1 truncate text-sm font-medium'>
                      {localized(line.name)}
                    </div>
                    <div className='shrink-0 text-sm tabular-nums'>
                      {formatQuantity(line.quantity, line.unit, t)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
