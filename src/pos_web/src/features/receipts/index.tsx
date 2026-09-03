import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  DoorOpen,
  Search,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import { getSettledTicketsOptions } from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'

const typeIcon: Record<string, LucideIcon> = {
  Room: DoorOpen,
  Table: Armchair,
  Counter: ShoppingBag,
}

/**
 * The bills that have closed, newest receipt first — the way back to one
 * after it left the floor, to reprint it or issue a credit note against it.
 * Typing a receipt number finds that one; otherwise the recent ones show.
 */
export function Receipts() {
  const t = useT()
  const localized = useLocalized()
  const locale = useLocale()
  const money = useMoney()
  const navigate = useNavigate()
  const language = useLanguage((s) => s.language)
  const [term, setTerm] = useState('')

  const digits = term.trim()
  const receiptNumber = /^\d+$/.test(digits) ? Number(digits) : undefined

  const { data: bills = [], isLoading } = useQuery({
    ...getSettledTicketsOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: 0,
        pageSize: 50,
        receiptNumber,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

  return (
    <div className='mx-auto flex max-w-3xl flex-col gap-4 p-4'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link to='/' aria-label={t('backToFloor')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <h1 className='text-xl font-bold'>{t('receipts')}</h1>
      </div>

      <div className='relative'>
        <Search className='text-muted-foreground absolute start-3 top-1/2 size-5 -translate-y-1/2' />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('searchReceiptNumber')}
          inputMode='numeric'
          className='h-12 ps-10 text-base'
          autoComplete='off'
        />
      </div>

      {isLoading ? (
        <Skeleton className='h-48 rounded-xl' />
      ) : bills.length === 0 ? (
        <p className='text-muted-foreground py-16 text-center'>
          {t('noReceipts')}
        </p>
      ) : (
        <div className='bg-card divide-y overflow-hidden rounded-xl border'>
          {bills.map((bill) => {
            const Icon = typeIcon[bill.type ?? ''] ?? ShoppingBag
            const typeLabel =
              bill.type === 'Room'
                ? t('room')
                : bill.type === 'Table'
                  ? t('table')
                  : t('counter')
            const title = localized(bill.locationName) || bill.label || typeLabel
            const refunded = toNumber(bill.refundedTotal)
            return (
              <button
                key={String(bill.id)}
                type='button'
                onClick={() =>
                  navigate({
                    to: '/ticket/$ticketId',
                    params: { ticketId: String(toNumber(bill.id)) },
                    search: { from: 'receipts' },
                  })
                }
                className='hover:bg-accent/50 flex h-16 w-full items-center gap-3 px-3 text-start'
              >
                <span className='w-14 shrink-0 font-semibold tabular-nums'>
                  #{toNumber(bill.receiptNumber)}
                </span>
                <Icon className='text-muted-foreground size-5 shrink-0' />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-base font-medium'>{title}</span>
                  <span className='text-muted-foreground block truncate text-sm'>
                    {bill.settledAt &&
                      new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(bill.settledAt))}
                    {refunded > 0 && ` · ${t('refundedSoFar')} −${money(refunded)}`}
                  </span>
                </span>
                <span className='shrink-0 text-lg font-semibold tabular-nums'>
                  {money(bill.total)}
                </span>
                <ChevronRight className='text-muted-foreground size-5 shrink-0 rtl:rotate-180' />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
