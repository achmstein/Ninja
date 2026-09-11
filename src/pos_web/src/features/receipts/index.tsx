import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  DoorOpen,
  Loader2,
  Search,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import { getSettledTickets } from '@/api/sales/sdk.gen'
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

const PAGE_SIZE = 50

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

  // The list grows a page at a time as the cashier scrolls; a receipt-number
  // search collapses it to that one bill. /settled has no total count, so a
  // full page means "maybe more" and a short page is the end.
  const query = useInfiniteQuery({
    queryKey: [{ _id: 'getSettledTicketsInfinite', receiptNumber }],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data } = await getSettledTickets({
        query: {
          'api-version': API_VERSION,
          pageIndex: pageParam,
          pageSize: PAGE_SIZE,
          receiptNumber,
        },
      })
      return data ?? []
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  })

  const bills = query.data?.pages.flat() ?? []
  const isLoading = query.isLoading

  // Load the next page when the sentinel at the end of the list scrolls in
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query
  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

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
        <div className='bg-card divide-y overflow-hidden rounded-xl border'>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className='flex h-16 w-full items-center gap-3 px-3'>
              {/* number, icon, place + date, total — a receipt row's shape */}
              <Skeleton className='h-5 w-10 shrink-0' />
              <Skeleton className='size-5 shrink-0 rounded' />
              <div className='min-w-0 flex-1 space-y-1.5'>
                <Skeleton className='h-4 w-1/2' />
                <Skeleton className='h-3 w-1/3' />
              </div>
              <Skeleton className='h-5 w-16 shrink-0' />
            </div>
          ))}
        </div>
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

      {/* Sentinel: reaching it pulls the next page. The spinner shows only
          while a page is on its way. */}
      {query.hasNextPage && (
        <div
          ref={loadMoreRef}
          className='text-muted-foreground flex justify-center py-4'
        >
          {query.isFetchingNextPage && (
            <Loader2 className='size-6 animate-spin' />
          )}
        </div>
      )}
    </div>
  )
}
