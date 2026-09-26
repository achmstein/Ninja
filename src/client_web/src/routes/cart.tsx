import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ShoppingBag, Trash2 } from 'lucide-react'
import { useBrand, useIsCloudKitchen } from '@/lib/brand'
import { cartCount, lineKey, useCart } from '@/lib/cart'
import { useLocalized, useT } from '@/lib/i18n'
import { springSoft } from '@/lib/motion'
import { useOrderPill } from '@/lib/order-pill'
import { PlaceIcon } from '@/lib/places'
import { usePlaceOrder } from '@/lib/use-place-order'
import { CartLineCard } from '@/components/cart/cart-line'
import { CheckoutAction, CheckoutDock } from '@/components/cart/checkout-dock'
import { CheckoutExtrasRows } from '@/components/cart/checkout-extras'
import { useCheckoutExtras } from '@/lib/use-checkout-extras'
import { type MorphPhase } from '@/components/motion/morph-button'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty, Panel } from '@/components/ninja/page/parts'
import { StillHereCard } from '@/components/places/still-here'
import { SignInSheet } from '@/components/sign-in-options'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

/**
 * The order, full screen: the tray's sheet grown to a page. Each line is a
 * card that steps up and down or swipes away, the extras (a note, a code,
 * points) sit in one panel under them, and the dock's slab stays at the
 * bottom with the total rolling and the one button that sends it.
 */
function CartPage() {
  const t = useT()
  const localized = useLocalized()
  const navigate = useNavigate()
  // The café takes a guest's order without a table, to collect
  const guestOrdersAnywhere = useBrand()?.guestOrdersAnywhere ?? false
  // No tables to scan: every order is collected, and a guest the café does not take signs in instead
  const cloudKitchen = useIsCloudKitchen()

  const { lines, clear } = useCart()
  const [signInOpen, setSignInOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  // The note, the code and the points, on the same rules as the tray's
  const extras = useCheckoutExtras()
  const { subtotal, promoDiscount, pointsDiscount: discount, total } = extras

  // Place order is one button through the whole send: a spinner while it
  // goes, a tick when it lands, and then the tick lifts off to become the
  // status pill at the top, which follows the order from there
  const [sent, setSent] = useState<'success' | 'error' | null>(null)
  const followOrder = useOrderPill((s) => s.follow)

  // The one ordering path (lib/use-place-order), the Counter's tray's too:
  // the carried-over table asked about, the guest or profile gate, one
  // request id per payload, the choices saved for next time
  const order = usePlaceOrder({
    onPlaced: (finish) => {
      // The tick holds a beat; then, in one render, the cart empties and
      // the pill takes the tick's place (same layoutId) at the top
      setSent('success')
      setTimeout(() => {
        followOrder()
        finish()
        setSent(null)
        navigate({ to: '/bills' })
      }, 480)
    },
    onFailed: () => {
      setSent('error')
      setTimeout(() => setSent(null), 350)
    },
  })
  // Room-beats-table lives in useOrderDestination (through the hook) so the
  // header chip and the payload can never disagree about where it goes
  const { destination, tableUnconfirmed, activePlace, isGuest } = order
  const orderPhase: MorphPhase = order.isPending ? 'busy' : (sent ?? 'idle')

  const placeOrder = () => order.submit(extras.payload())

  if (lines.length === 0) {
    return (
      <NinjaPage title={t('ninjaYourOrder')} back='/'>
        <Empty icon={ShoppingBag} title={t('yourCartIsEmpty')}>
          <Button asChild size='lg' className='rounded-full px-8'>
            <Link to='/'>{t('browseMenu')}</Link>
          </Button>
        </Empty>
      </NinjaPage>
    )
  }

  // Where it goes, when it goes somewhere: a carried-over table is asked about first
  const whereTo = tableUnconfirmed && activePlace ? (
    <StillHereCard place={activePlace} />
  ) : destination ? (
    <Panel className='text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm font-medium'>
      <PlaceIcon kind={destination.placeKind} className='size-4' />
      {localized(destination.name)}
    </Panel>
  ) : (isGuest && guestOrdersAnywhere) || cloudKitchen ? (
    <Panel className='text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm font-medium'>
      <ShoppingBag className='size-4' />
      {/* "No table" means nothing where there never are tables */}
      {t(cloudKitchen ? 'orderToCollect' : 'guestOrderToCollect')}
    </Panel>
  ) : null

  return (
    // No dock on this page: -mb cancels the root <main>'s clearance for it,
    // and the page is at least a screen tall so the checkout sits at the bottom
    <div className='-mb-[calc(5rem+env(safe-area-inset-bottom))] overflow-x-clip'>
      <NinjaPage
        title={t('ninjaYourOrder')}
        subtitle={t('itemCount', { count: cartCount(lines) })}
        back='/'
        className='mx-auto min-h-[calc(100svh-4rem-env(safe-area-inset-top))] w-full max-w-lg'
        action={
          <button
            type='button'
            aria-label={t('clearCart')}
            onClick={() => setClearConfirmOpen(true)}
            className='bg-muted/80 active:bg-muted grid size-10 place-items-center rounded-full transition-colors'
          >
            <Trash2 className='size-[18px]' />
          </button>
        }
      >
        <Rise className='flex flex-col gap-3'>
          <RiseItem className='flex flex-col gap-2.5'>
            <AnimatePresence initial={false}>
              {lines.map((line) => (
                <CartLineCard key={lineKey(line)} line={line} />
              ))}
            </AnimatePresence>
          </RiseItem>
          {whereTo && (
            <RiseItem>
              <motion.div layout='position' transition={springSoft}>
                {whereTo}
              </motion.div>
            </RiseItem>
          )}
          <RiseItem>
            <motion.div layout='position' transition={springSoft}>
              <Panel className='divide-border/60 flex flex-col divide-y'>
                <CheckoutExtrasRows extras={extras} />
              </Panel>
            </motion.div>
          </RiseItem>
        </Rise>

        <CheckoutDock subtotal={subtotal} promoDiscount={promoDiscount} pointsDiscount={discount} total={total}>
          <CheckoutAction
            block={order.block}
            cloudKitchen={cloudKitchen}
            isGuest={isGuest}
            phase={orderPhase}
            waiting={tableUnconfirmed}
            onOrder={placeOrder}
            onSignIn={() => setSignInOpen(true)}
          />
        </CheckoutDock>
      </NinjaPage>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearCartQuestion')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className='bg-destructive hover:bg-destructive/90 text-white' onClick={() => clear()}>
              {t('clear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {order.dialogs}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  )
}
