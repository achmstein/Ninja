import { useMemo } from 'react'
import { ChefHat, Volume2 } from 'lucide-react'
import type { KitchenOrder, PreparationStatus } from '@/api/ordering/types.gen'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { OrderCard } from './order-card'
import { useKitchenOrders, useNowMs } from './use-kitchen-orders'
import { usePreparation } from './use-preparation'
import { useSoundUnlock } from './use-sound-unlock'

const LANES: {
  key: PreparationStatus
  label: TranslationKey
  dot: string
}[] = [
  { key: 'NotStarted', label: 'laneNew', dot: 'bg-sky-500' },
  { key: 'Preparing', label: 'laneInProgress', dot: 'bg-amber-500' },
  { key: 'Ready', label: 'laneReady', dot: 'bg-emerald-500' },
]

/**
 * The kitchen board: three lanes — New, In progress, Ready — each scrolling
 * on its own, oldest order first. Everything confirmed lands in New the
 * moment it is confirmed (app order, table QR or counter sale alike); Start
 * and Ready move it right, Recall brings a bumped card back, and Ready cards
 * clear themselves after half an hour. Sized to be read from across a
 * kitchen and tapped with a wet finger.
 */
export function Board() {
  const t = useT()
  const nowMs = useNowMs()
  const { orders, isLoading } = useKitchenOrders()
  const { setPreparation, actingOrderNumber } = usePreparation()
  const soundUnlocked = useSoundUnlock()

  const lanes = useMemo(() => {
    const byLane = new Map<PreparationStatus, KitchenOrder[]>(
      LANES.map((lane) => [lane.key, []])
    )
    for (const order of orders) {
      const lane = (order.preparation ?? 'NotStarted') as PreparationStatus
      byLane.get(lane)?.push(order)
    }
    return byLane
  }, [orders])

  return (
    // The header is 4rem; the rest of the viewport is the board, so each
    // lane scrolls inside its own column instead of the page growing
    <div className='flex h-[calc(100svh-4rem)] flex-col'>
      {!soundUnlocked && (
        <Alert className='mx-3 mt-3 w-auto border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'>
          <Volume2 />
          <AlertTitle className='text-base'>{t('soundBanner')}</AlertTitle>
        </Alert>
      )}

      {!isLoading && orders.length === 0 ? (
        <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'>
          <ChefHat className='size-16 opacity-40' />
          <p className='text-2xl font-semibold'>{t('noOrders')}</p>
          <p className='text-base'>{t('noOrdersHint')}</p>
        </div>
      ) : (
        <div className='grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 md:grid-cols-3'>
          {LANES.map((lane) => {
            const laneOrders = lanes.get(lane.key) ?? []
            return (
              <section
                key={lane.key}
                className='bg-muted/30 flex min-h-0 flex-col rounded-xl border'
              >
                <header className='flex items-center gap-2 px-4 py-3'>
                  <span className={cn('size-3 rounded-full', lane.dot)} />
                  <h2 className='text-lg font-semibold'>{t(lane.label)}</h2>
                  <Badge variant='secondary' className='h-6 tabular-nums'>
                    {laneOrders.length}
                  </Badge>
                </header>
                <div className='min-h-0 flex-1 overflow-y-auto px-3 pb-3'>
                  <div className='flex flex-col gap-3'>
                    {isLoading &&
                      lane.key === 'NotStarted' &&
                      [0, 1].map((i) => (
                        <Skeleton key={i} className='h-40 rounded-xl' />
                      ))}
                    {laneOrders.map((order) => {
                      const id = Number(order.orderNumber)
                      return (
                        <OrderCard
                          key={id}
                          order={order}
                          nowMs={nowMs}
                          isActing={actingOrderNumber === id}
                          onStart={() => setPreparation(id, 'Preparing')}
                          onReady={() => setPreparation(id, 'Ready')}
                          onRecall={() => setPreparation(id, 'Preparing')}
                        />
                      )
                    })}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
