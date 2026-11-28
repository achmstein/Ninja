import { Fragment, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, ChevronRight, Loader2, Search } from 'lucide-react'
import { getSettledTickets } from '@/api/sales/sdk.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { BillTitle } from '@/features/deliveries/bill-title'
import { billLabel } from '@/features/deliveries/delivery-format'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { API_VERSION } from '@/lib/api-client'
import { dayKey, friendlyDay, friendlyTime } from '@/lib/friendly-day'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { ReceiptPreview } from './receipt-preview'

const PAGE_SIZE = 50

/**
 * The bills that have closed, newest receipt first — the way back to one
 * after it left the floor, to reprint it or issue a credit note against it.
 * Typing a receipt number finds that one; otherwise the recent ones show,
 * under the day they closed on (Today, Yesterday, then the day by name), each
 * with its name first and whole and its time alone.
 *
 * A receipt is read where it is picked: the list keeps its place and the
 * bill shows beside it (the newest to begin with), or in a sheet over it on
 * a phone. Looking for one bill among a night's used to mean opening each
 * and coming back. The bill's own page, where it is refunded, is a press
 * away from what shows.
 */
export function Receipts() {
  const t = useT()
  const localized = useLocalized()
  const locale = useLocale()
  const money = useMoney()
  const isMobile = useIsMobile()
  const language = useLanguage((s) => s.language)
  const [term, setTerm] = useState('')
  // The receipt being read; none until one is picked (a wide screen reads the newest)
  const [pickedId, setPickedId] = useState<number | null>(null)

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

  const titleOf = (bill: (typeof bills)[number]) => {
    // A delivery's bill reads "#42 · Mona" (older ones with a scooter
    // emoji first): drawn with the bike, never the emoji
    const label = billLabel(bill.label)
    const typeLabel =
      bill.type === 'Room'
        ? t('room')
        : bill.type === 'Table'
          ? t('table')
          : t('counter')
    return {
      title: localized(bill.locationName) || label.text || typeLabel,
    }
  }

  // Beside the list there is always a bill to read: the one picked while it
  // is still listed, the newest otherwise. A phone shows only what was picked
  const picked = bills.find((bill) => toNumber(bill.id) === pickedId)
  const shown = picked ?? (isMobile ? undefined : bills[0])
  const shownId = shown ? toNumber(shown.id) : null
  const preview = shown && shownId != null && (
    <ReceiptPreview
      key={shownId}
      ticketId={shownId}
      title={<BillTitle title={titleOf(shown).title} className='block break-words' />}
    />
  )

  const list = (
    <>
      {/* Built like the sale screen's heads (8 + 48 + 8), so the rule under it meets the one under the receipt's */}
      <div className='flex shrink-0 items-center gap-2 border-b px-3 py-2'>
        <Button asChild variant='ghost' size='icon' className='size-12 shrink-0'>
          <Link to='/' aria-label={t('backToFloor')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <h1 className='type-title'>{t('receipts')}</h1>
      </div>

      <div className='shrink-0 border-b p-2'>
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
      </div>

      {/* Plain rows under thin rules, as the till lists everything else (customers, an order's lines,
          who is paying): never a boxed card with rounded corners */}
      <div className='min-h-0 flex-1 md:overflow-y-auto'>
        {isLoading ? (
          <div className='divide-y border-b'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='flex h-16 w-full items-center gap-3 px-4'>
                {/* the name over its number and time, and the total: a receipt row's shape */}
                <div className='min-w-0 flex-1 space-y-1.5'>
                  <Skeleton className='h-4 w-1/2' />
                  <Skeleton className='h-3 w-1/3' />
                </div>
                <Skeleton className='h-5 w-16 shrink-0' />
              </div>
            ))}
          </div>
        ) : bills.length === 0 ? (
          <p className='text-muted-foreground py-16 text-center'>{t('noReceipts')}</p>
        ) : (
          <div>
            {bills.map((bill, index) => {
              const { title } = titleOf(bill)
              const refunded = toNumber(bill.refundedTotal)
              const id = toNumber(bill.id)
              const reading = id === shownId
              const settled = bill.settledAt ? new Date(bill.settledAt) : null
              const before = bills[index - 1]?.settledAt
              // The day is said once, over the first receipt of it
              const startsDay = settled != null && (!before || dayKey(new Date(before)) !== dayKey(settled))
              return (
                <Fragment key={String(bill.id)}>
                  {startsDay && (
                    <div className='bg-muted text-muted-foreground type-label sticky top-0 z-10 border-b px-4 pt-3 pb-1'>
                      {friendlyDay(settled, locale, { today: t('today'), yesterday: t('yesterday') })}
                    </div>
                  )}
                  <button
                    type='button'
                    onClick={() => setPickedId(id)}
                    aria-current={reading ? 'true' : undefined}
                    className={cn(
                      'hover:bg-accent/50 flex min-h-16 w-full items-center gap-3 border-b px-4 py-2 text-start',
                      // The one being read: tinted, and marked down its start edge
                      reading && 'bg-accent hover:bg-accent border-s-primary border-s-[3px] ps-[calc(1rem-3px)]',
                    )}
                  >
                    <span className='min-w-0 flex-1'>
                      {/* The name first and whole: it wraps, it is never cut */}
                      <BillTitle title={title} className='type-heading block break-words' />
                      <span className='text-muted-foreground type-detail block tabular-nums'>
                        {'#\u200F'}
                        {toNumber(bill.receiptNumber)}
                        {settled && ` · ${friendlyTime(settled, locale)}`}
                        {refunded > 0 && <span className='text-destructive'>{` · ${t('refundedSoFar')} −${money(refunded)}`}</span>}
                      </span>
                    </span>
                    <span className='type-heading shrink-0 tabular-nums'>{money(bill.total)}</span>
                    <ChevronRight className='text-muted-foreground size-5 shrink-0 md:hidden rtl:rotate-180' />
                  </button>
                </Fragment>
              )
            })}
          </div>
        )}

        {/* Sentinel: reaching it pulls the next page. The spinner shows only while a page is on its way. */}
        {query.hasNextPage && (
          <div ref={loadMoreRef} className='text-muted-foreground flex justify-center py-4'>
            {query.isFetchingNextPage && <Loader2 className='size-6 animate-spin' />}
          </div>
        )}
      </div>
    </>
  )

  return (
    // Two panels divided by a rule, across the whole screen, as the sale screen is: the list at a
    // width its rows read well at (narrower on a small tablet), and the receipt across all the
    // rest. A phone has the list alone, the receipt in a sheet over it
    <div className='flex md:h-[calc(100svh-4rem)]'>
      <div className='flex min-w-0 flex-col max-md:flex-1 md:w-[clamp(20rem,32vw,28rem)] md:shrink-0 md:border-e'>{list}</div>

      {isMobile ? (
        <Sheet
          open={picked != null}
          onOpenChange={(open) => {
            if (!open) setPickedId(null)
          }}
        >
          <SheetContent aria-describedby={undefined} className='flex h-[calc(100svh-2.5rem)] flex-col'>
            <SheetTitle className='sr-only'>{t('receipts')}</SheetTitle>
            {preview}
          </SheetContent>
        </Sheet>
      ) : (
        <section className='flex min-w-0 flex-1 flex-col'>
          {preview || <p className='text-muted-foreground m-auto p-6 text-center'>{isLoading ? '' : t('noReceipts')}</p>}
        </section>
      )}
    </div>
  )
}
