import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LogIn, QrCode } from 'lucide-react'
import { usePrice, useT } from '@/lib/i18n'
import { springSoft } from '@/lib/motion'
import { type CheckoutBlock } from '@/lib/order-payload'
import { cn } from '@/lib/utils'
import { MorphButton, type MorphPhase } from '@/components/motion/morph-button'
import { Odometer } from '@/components/ninja/odometer'
import { Slab } from '@/components/ninja/page/parts'
import { ORDER_PILL_ID } from '@/components/order-pill'
import { ScanTableButton } from '@/components/places/table-scanner'

/** The action on the dark slab: the page's own light, which reads on the slab whatever the café's colour */
const ON_SLAB = 'bg-background text-foreground hover:bg-background/90'

/**
 * The foot of the order: the dock's dark slab kept in the thumb's reach
 * while the lines scroll above it. What came off the order opens above
 * the total as it applies, the total rolls like the tray's, and the one
 * action is the button that becomes the spinner, the tick, and then the
 * order's pill at the top.
 */
export function CheckoutDock({
  subtotal,
  promoDiscount,
  pointsDiscount,
  total,
  children,
}: {
  subtotal: number
  promoDiscount: number
  pointsDiscount: number
  total: number
  /** The action: ordering, or what stands in the way of it */
  children: ReactNode
}) {
  const t = useT()
  const price = usePrice()
  const discounted = promoDiscount > 0 || pointsDiscount > 0
  const saving = 'flex items-baseline justify-between text-[13px] tabular-nums text-emerald-400 dark:text-emerald-600'

  return (
    <div className='sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 mt-auto'>
      <Slab className='flex flex-col gap-3 p-4'>
        <AnimatePresence initial={false}>
          {discounted && (
            <motion.div
              key='breakdown'
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className='flex flex-col gap-1 overflow-hidden px-1'
            >
              <div className='text-muted-foreground flex items-baseline justify-between text-[13px] tabular-nums'>
                <span>{t('subtotal')}</span>
                <span>{price(subtotal)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className={saving}>
                  <span>{t('promoDiscount')}</span>
                  <span>−{price(promoDiscount)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className={saving}>
                  <span>{t('pointsDiscount')}</span>
                  <span>−{price(pointsDiscount)}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div className='flex items-baseline justify-between gap-3 px-1'>
          <span className='text-muted-foreground text-[13px] font-semibold'>{t('total')}</span>
          <Odometer value={price(total)} className='text-[30px] font-extrabold' />
        </div>
        {children}
      </Slab>
    </div>
  )
}

/**
 * Ordering never needs an account, so where nothing stands in the way the
 * action is the order itself, with signing in offered under it (it is what
 * earns points and keeps the history). A guest with no table, where the
 * café needs one, scans it or signs in; where the branch wants a name on a
 * table order, they sign in. Either way it says so before the tap, not after.
 */
export function CheckoutAction({
  block,
  cloudKitchen,
  isGuest,
  phase,
  waiting,
  onOrder,
  onSignIn,
}: {
  block: CheckoutBlock
  cloudKitchen: boolean
  isGuest: boolean
  phase: MorphPhase
  /** A carried-over table not yet confirmed: nothing goes until it is */
  waiting: boolean
  onOrder: () => void
  onSignIn: () => void
}) {
  const t = useT()
  const signIn = (
    <button
      type='button'
      onClick={onSignIn}
      className='flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold opacity-80 transition-opacity hover:opacity-100'
    >
      <LogIn className='size-4' />
      {isGuest && !block ? t('signInInstead') : t('signIn')}
    </button>
  )

  if (block) {
    const needsTable = block === 'table' && !cloudKitchen
    return (
      <div className='flex flex-col gap-2'>
        <p className='text-muted-foreground flex items-start gap-2 px-1 text-[13px]'>
          {needsTable ? <QrCode className='mt-0.5 size-4 shrink-0' /> : <LogIn className='mt-0.5 size-4 shrink-0' />}
          {block === 'account' ? t('tableOrdersNeedAccount') : cloudKitchen ? t('signInToOrderPickup') : t('scanTableToOrder')}
        </p>
        {/* A table to scan: the camera, in the app; the phone's own camera would open the link in the browser */}
        {needsTable ? (
          <>
            <ScanTableButton className={cn(ON_SLAB, 'h-[52px] w-full rounded-full font-bold')} />
            {signIn}
          </>
        ) : (
          <button
            type='button'
            onClick={onSignIn}
            className={cn(ON_SLAB, 'flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-bold')}
          >
            <LogIn className='size-4' />
            {t('signIn')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-1'>
      <MorphButton phase={phase} layoutId={ORDER_PILL_ID} disabled={waiting} onClick={onOrder} height={52} className={cn(phase !== 'success' && ON_SLAB, 'text-[15px] font-bold')}>
        {isGuest ? t('orderAsGuest') : t('placeOrder')}
      </MorphButton>
      {isGuest && signIn}
    </div>
  )
}
