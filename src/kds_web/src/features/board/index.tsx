import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChefHat } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { OrderCard, OrderCardSkeleton } from './order-card'
import { useKitchenOrders, useNowMs } from './use-kitchen-orders'
import { useReady } from './use-ready'
import { useStation } from './use-station'

/**
 * The kitchen board: open orders, oldest first, as many across as the screen
 * fits, read across like a line of text: the next ticket goes to the next
 * column, and after the last column back to the first. Everything confirmed lands here the moment it is
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
  const { stationId } = useStation()

  const open = useMemo(() => orders.filter((order) => order.readyAt == null), [orders])

  return (
    // The header is 4rem; the rest of the viewport is the board, which
    // scrolls on its own so the header never leaves the screen
    // A quiet ground under white tickets
    <div className='bg-muted/60 dark:bg-background flex h-[calc(100svh-4rem)] flex-col'>
      {!isLoading && open.length === 0 ? (
        <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'>
          <ChefHat className='size-16 opacity-40' />
          <p className='type-place'>{t('noOrders')}</p>
        </div>
      ) : (
        <div className='min-h-0 flex-1 overflow-y-auto p-3'>
          <Dealt>
            {isLoading
              ? [2, 3, 1, 2].map((items, i) => <OrderCardSkeleton key={i} items={items} />)
              : open.map((order) => {
                  const id = Number(order.orderNumber)
                  return (
                    <OrderCard
                      key={id}
                      order={order}
                      nowMs={nowMs}
                      isActing={actingOrderNumber === id}
                      onReady={() => setReady(id, true)}
                      showParts={stationId == null}
                    />
                  )
                })}
          </Dealt>
        </div>
      )}
    </div>
  )
}

/** A ticket is never narrower than this, and the gap between two */
const MIN_COLUMN = 272
const GAP = 12

/**
 * Tickets dealt across the columns in turn, each column as tall as its own
 * tickets. Not CSS columns: those pour down the first column before starting
 * the next and then even the heights out, so a sixth ticket on a screen five
 * wide landed under the third. Not a grid either: its rows are as tall as
 * their tallest ticket, which leaves holes under the short ones.
 */
function Dealt({ children }: { children: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(1)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const fit = () => setCount(Math.max(1, Math.floor((node.clientWidth + GAP) / (MIN_COLUMN + GAP))))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const columns: ReactNode[][] = Array.from({ length: count }, () => [])
  children.forEach((child, index) => columns[index % count].push(child))

  return (
    <div ref={ref} className='flex items-start gap-3'>
      {columns.map((column, index) => (
        <div key={index} className='flex min-w-0 flex-1 flex-col gap-3'>
          {column}
        </div>
      ))}
    </div>
  )
}
