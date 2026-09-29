import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { CircleAlert, Loader2, Star } from 'lucide-react'
import { rateOrder, type OrderSummary } from '@/api/ordering'
import { type BillView } from '@/api/sales'
import { API_VERSION } from '@/lib/api-client'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

/**
 * The rating, on the paid bill: one row of stars for the customer's own
 * rounds on it. Rating is account-only server-side, so a guest gets none.
 * Rated already, it shows what they gave.
 */
export function BillStars({
  bill,
  ordersById,
}: {
  bill: BillView
  ordersById: Map<number, OrderSummary>
}) {
  const t = useT()
  const auth = useAuth()
  if (!auth.isAuthenticated) return null

  const mine = [
    ...new Set(
      (bill.lines ?? [])
        .filter((line) => line.isMine && line.orderId != null)
        .map((line) => Number(line.orderId))
    ),
  ]
    .map((id) => ordersById.get(id))
    .filter((order): order is OrderSummary => order != null)
  if (mine.length === 0) return null

  const unrated = mine.filter((order) => order.ratingValue == null)
  if (unrated.length === 0) {
    const value = Number(mine[0].ratingValue ?? 0)
    return (
      <div className='flex items-center gap-1 pt-1'>
        <span className='text-muted-foreground text-caption'>
          {t('yourRating')}
        </span>
        <StarsDisplay value={value} />
      </div>
    )
  }
  return (
    <StarRow orderIds={unrated.map((order) => Number(order.orderNumber))} />
  )
}

function StarsDisplay({ value }: { value: number }) {
  return (
    <span className='text-muted-foreground flex gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${star <= value ? 'fill-current' : 'opacity-40'}`}
        />
      ))}
    </span>
  )
}

/**
 * Five stars on the paid bill. A tap on one opens the rating sheet with
 * that star chosen and room for a word, as the app does; the sheet rates
 * every round of theirs the bill covered.
 */
function StarRow({ orderIds }: { orderIds: number[] }) {
  const t = useT()
  const [hover, setHover] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <span className='text-muted-foreground pt-1 text-caption'>
        {t('ratedThanks')}
      </span>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2 pt-1'>
      <span className='text-caption font-semibold'>{t('howWasIt')}</span>
      <div
        className='text-amber-400 flex items-center'
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type='button'
            aria-label={String(value)}
            className='p-0.5'
            onMouseEnter={() => setHover(value)}
            onClick={() => setChosen(value)}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                value <= hover ? 'fill-current' : 'text-muted-foreground/40'
              )}
            />
          </button>
        ))}
      </div>
      <RatingSheet
        orderIds={orderIds}
        initialRating={chosen ?? 5}
        open={chosen != null}
        onOpenChange={(open) => {
          if (!open) setChosen(null)
        }}
        onRated={() => setDone(true)}
      />
    </div>
  )
}

const RATING_LABELS: Record<number, TranslationKey> = {
  1: 'ratingPoor',
  2: 'ratingFair',
  3: 'ratingGood',
  4: 'ratingVeryGood',
  5: 'ratingExcellent',
}

function RatingSheet({
  orderIds,
  initialRating,
  open,
  onOpenChange,
  onRated,
}: {
  orderIds: number[]
  initialRating: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onRated: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(initialRating)
  const [comment, setComment] = useState('')

  // The star tapped on the tile is the sheet's starting point each time it
  // opens, and the comment box starts empty
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setRating(initialRating)
      setComment('')
    }
  }

  const rateAll = useMutation({
    mutationFn: async () => {
      for (const orderId of orderIds) {
        await rateOrder({
          path: { orderId },
          body: { ratingValue: rating, comment: comment.trim() || null },
          headers: { 'x-requestid': crypto.randomUUID() },
          query: { 'api-version': API_VERSION },
          throwOnError: true,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
      onRated()
      onOpenChange(false)
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
      >

        <SheetHeader>
          <SheetTitle className='heading text-headline pe-8'>
            {t('rateYourOrder')}
          </SheetTitle>
        </SheetHeader>

        <div className='mt-6 flex justify-center gap-1'>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type='button'
              disabled={rateAll.isPending}
              onClick={() => setRating(star)}
              aria-label={`${star} stars`}
            >
              <Star
                className={`h-10 w-10 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
              />
            </button>
          ))}
        </div>
        <p className='text-muted-foreground mt-2 text-center text-body'>
          {t(RATING_LABELS[rating])}
        </p>

        <p className='mt-6 text-note font-semibold'>{t('yourReviewOptional')}</p>
        <Textarea
          rows={3}
          maxLength={500}
          className='mt-2'
          placeholder={t('shareYourExperience')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {rateAll.isError && (
          <div className='bg-destructive/10 text-destructive mt-4 flex items-center gap-2 rounded-lg p-3 text-caption'>
            <CircleAlert className='h-4 w-4 shrink-0' />
            {t('failedToPlaceOrder')}
          </div>
        )}

        <Button
          size='lg'
          className='mt-6 w-full rounded-pill font-bold'
          disabled={rateAll.isPending}
          onClick={() => rateAll.mutate()}
        >
          {rateAll.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            t('submitRating')
          )}
        </Button>
      </SheetContent>
    </Sheet>
  )
}

