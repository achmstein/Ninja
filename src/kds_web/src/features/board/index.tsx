import { useMemo } from 'react'
import { ChefHat, Volume2 } from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/lib/i18n'
import { OrderCard } from './order-card'
import { useKitchenOrders, useNowMs } from './use-kitchen-orders'
import { useReady } from './use-ready'
import { useSoundUnlock } from './use-sound-unlock'

/**
 * The kitchen board: one grid of open orders, oldest first, as many across
 * as the screen fits. Everything confirmed lands here the moment it is
 * confirmed (app order, table QR or counter sale alike); Ready takes it
 * off the board and into the history behind the clock icon in the header,
 * from where it can be brought back. Sized for a tablet at arm's length,
 * tapped with a wet finger.
 */
export function Board() {
  const t = useT()
  const nowMs = useNowMs()
  const { orders, isLoading } = useKitchenOrders()
  const { setReady, actingOrderNumber } = useReady()
  const soundUnlocked = useSoundUnlock()

  const open = useMemo(
    () => orders.filter((order) => order.readyAt == null),
    [orders]
  )

  return (
    // The header is 4rem; the rest of the viewport is the board, which
    // scrolls on its own so the header never leaves the screen
    <div className='flex h-[calc(100svh-4rem)] flex-col'>
      {!soundUnlocked && (
        <Alert className='mx-3 mt-3 w-auto border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'>
          <Volume2 />
          <AlertTitle className='text-base'>{t('soundBanner')}</AlertTitle>
        </Alert>
      )}

      {!isLoading && open.length === 0 ? (
        <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'>
          <ChefHat className='size-16 opacity-40' />
          <p className='text-2xl font-semibold'>{t('noOrders')}</p>
          <p className='text-base'>{t('noOrdersHint')}</p>
        </div>
      ) : (
        <div className='min-h-0 flex-1 overflow-y-auto p-3'>
          {/* Columns, not a grid: cards are as tall as their own order, and a
              grid would pad every row out to its tallest card, leaving holes
              under the short ones */}
          <div className='columns-[16rem] gap-3'>
            {isLoading &&
              [0, 1, 2].map((i) => (
                <Skeleton key={i} className='mb-3 h-36 rounded-xl' />
              ))}
            {open.map((order) => {
              const id = Number(order.orderNumber)
              return (
                <div key={id} className='mb-3 break-inside-avoid'>
                  <OrderCard
                    order={order}
                    nowMs={nowMs}
                    isActing={actingOrderNumber === id}
                    onReady={() => setReady(id, true)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
