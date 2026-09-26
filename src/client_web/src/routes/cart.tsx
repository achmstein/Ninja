import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft,
  Award,
  Coffee,
  Loader2,
  LogIn,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  getAccountOptions,
  getPointsValueOptions,
} from '@/api/loyalty/@tanstack/react-query.gen'
import { quotePromoOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
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
import { MorphButton, type MorphPhase } from '@/components/motion/morph-button'
import { ORDER_PILL_ID } from '@/components/order-pill'
import { useOrderPill } from '@/lib/order-pill'
import { ScanTableButton } from '@/components/places/table-scanner'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ImageWithFallback } from '@/components/image-fallback'
import { SignInSheet } from '@/components/sign-in-options'
import { cartTotal, lineKey, useCart } from '@/lib/cart'
import { PlaceIcon } from '@/lib/places'
import { StillHereCard } from '@/components/places/still-here'
import { useBrand, useFeatures, useIsCloudKitchen } from '@/lib/brand'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { usePlaceOrder } from '@/lib/use-place-order'

export const Route = createFileRoute('/cart')({
  component: CartPage,
})

const POINTS_STEP = 50
const POINTS_PER_EGP = 100

// Debounce the slider so the server points-value query isn't spammed
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

function CartPage() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const localized = useLocalized()
  const price = usePrice()
  const auth = useAuth()
  // Points are loyalty's: without the module there is no balance to ask for and nothing to redeem
  const { loyalty: loyaltyOn } = useFeatures()
  // The café takes a guest's order without a table, to collect
  const guestOrdersAnywhere = useBrand()?.guestOrdersAnywhere ?? false
  // No tables to scan: every order is collected, and a guest the café
  // does not take signs in instead
  const cloudKitchen = useIsCloudKitchen()
  const navigate = useNavigate()

  const { lines, setQuantity, clear } = useCart()
  const [note, setNote] = useState('')
  const [signInOpen, setSignInOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [redeemEnabled, setRedeemEnabled] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
  const [promoInput, setPromoInput] = useState('')
  // The code as applied; Catalog quotes it against the live subtotal and
  // redeems it when the order's items check out
  const [promoCode, setPromoCode] = useState<string | null>(null)

  const userId = auth.user?.profile?.sub ?? ''

  // Loyalty balance (a customer may not have an account yet; treat as 0)
  const { data: loyaltyAccount } = useQuery({
    ...getAccountOptions({
      path: { userId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: loyaltyOn && auth.isAuthenticated && !!userId && lines.length > 0,
    retry: false,
  })
  const pointsBalance = loyaltyOn ? Number(loyaltyAccount?.pointsBalance ?? 0) : 0

  const subtotal = cartTotal(lines)
  // Mobile parity: at most 100 points per EGP of the order total
  const maxRedeemable = Math.min(
    pointsBalance,
    Math.floor(subtotal * POINTS_PER_EGP),
  )

  const effectivePoints = redeemEnabled ? pointsToRedeem : 0
  const debouncedPoints = useDebounced(effectivePoints, 300)

  const pointsValueQuery = useQuery({
    ...getPointsValueOptions({
      query: { 'api-version': API_VERSION, points: debouncedPoints },
    }),
    enabled: debouncedPoints > 0,
  })

  const promoQuery = useQuery({
    ...quotePromoOptions({
      query: { 'api-version': API_VERSION, code: promoCode ?? '', subtotal },
    }),
    enabled: !!promoCode && subtotal > 0,
    retry: false,
  })
  const promoQuote = promoCode ? promoQuery.data : undefined
  const promoDiscount =
    promoQuote && !promoQuote.reason
      ? Math.min(Number(promoQuote.discount ?? 0), subtotal)
      : 0
  const promoReason = promoQuery.isError
    ? 'error'
    : (promoQuote?.reason ?? null)
  const promoReasonKey = (reason: string) =>
    reason === 'NotFound'
      ? 'promoNotFound'
      : reason === 'UsedUp'
        ? 'promoUsedUp'
        : reason === 'AlreadyUsed'
          ? 'promoAlreadyUsed'
          : reason === 'BelowMinimum'
            ? 'promoBelowMinimum'
            : 'promoNotValidNow'
  const clearPromo = () => {
    setPromoCode(null)
    setPromoInput('')
  }

  // The server owns the discount math; on failure redemption is inert until
  // the customer toggles it again (derived, no state sync needed)
  useEffect(() => {
    if (pointsValueQuery.isError) toast.error(t('anErrorOccurred'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsValueQuery.isError])
  const redeemActive = redeemEnabled && !pointsValueQuery.isError

  const discount =
    redeemActive && debouncedPoints > 0 && debouncedPoints === effectivePoints
      ? Math.min(Number(pointsValueQuery.data?.discountValue ?? 0), subtotal)
      : 0
  const total = Math.max(0, subtotal - promoDiscount - discount)

  // Place order is one button through the whole send: a spinner while it
  // goes, a tick when it lands — and then the tick lifts off to become the
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

  const handleCheckout = () =>
    order.submit({
      note,
      // Only what the quotes accepted: the server drops a code that no
      // longer applies rather than failing the order, and a guest's points
      // never go (the payload leaves them out)
      points: discount > 0 ? debouncedPoints : 0,
      promo: promoDiscount > 0 ? promoCode : null,
      loyaltyDiscount: discount,
    })

  if (lines.length === 0) {
    return (
      <div className='flex h-[70svh] flex-col items-center justify-center gap-3 text-center'>
        <ShoppingBag className='text-muted-foreground/40 h-10 w-10' />
        <p className='text-muted-foreground'>{t('yourCartIsEmpty')}</p>
        <Button asChild className='rounded-full px-8'>
          <Link to='/'>{t('browseMenu')}</Link>
        </Button>
      </div>
    )
  }

  // A guest orders against the table they are sitting at. Without one there is
  // nothing anchoring the order to someone in the building, so the only ways
  // forward are to scan the table or to sign in — the server refuses it either
  // way, and finding that out after tapping Order would be the wrong lesson.
  // A café that takes guests' orders from anywhere lets it through, to collect.
  const guestNeedsTable = order.block === 'table'
  // The branch wants a name it can hold to on a table order: a guest at a
  // table signs in first. Ordering refuses it too; this just says so
  // before the tap rather than after.
  const guestNeedsAccount = order.block === 'account'

  // Ordering never needs an account. Signing in is offered underneath rather
  // than in the way, since it is what earns points and keeps the order history.
  const checkoutButton =
    guestNeedsTable || guestNeedsAccount ? (
      <div className='flex flex-col gap-3 border-t pt-4'>
        <div className='flex items-start gap-2 text-sm'>
          {guestNeedsAccount || cloudKitchen ? (
            <LogIn className='text-primary mt-0.5 h-4 w-4 shrink-0' />
          ) : (
            <QrCode className='text-primary mt-0.5 h-4 w-4 shrink-0' />
          )}
          <span>
            {guestNeedsAccount
              ? t('tableOrdersNeedAccount')
              : cloudKitchen
                ? t('signInToOrderPickup')
                : t('scanTableToOrder')}
          </span>
        </div>
        {/* A table to scan: the camera, in the app — the phone's own camera
            opens the link in the browser, not in an installed app */}
        {guestNeedsTable && !cloudKitchen && (
          <ScanTableButton className='w-full rounded-pill' />
        )}
        <Button
          size='lg'
          variant={guestNeedsTable && !cloudKitchen ? 'outline' : 'default'}
          className='w-full rounded-pill'
          onClick={() => setSignInOpen(true)}
        >
          <LogIn className='h-4 w-4' />
          {t('signIn')}
        </Button>
      </div>
    ) : (
      <div className='flex flex-col gap-2'>
        <MorphButton
          phase={orderPhase}
          layoutId={ORDER_PILL_ID}
          disabled={tableUnconfirmed}
          onClick={handleCheckout}
        >
          {isGuest ? t('orderAsGuest') : t('placeOrder')}
        </MorphButton>
        {isGuest && (
          <Button
            variant='ghost'
            size='sm'
            className='w-full rounded-pill'
            onClick={() => setSignInOpen(true)}
          >
            <LogIn className='h-4 w-4' />
            {t('signInInstead')}
          </Button>
        )}
      </div>
    )

  return (
    // Mobile app parity: one scrolling column, checkout group (note → points
    // → total → button) pushed to the screen bottom when the cart is short.
    // min-h fills the viewport; -mb-20 cancels the root <main>'s pb-20 (that
    // clearance was for the fixed bar this page no longer has).
    <div className='-mb-[calc(5rem+env(safe-area-inset-bottom))] flex min-h-[calc(100svh-env(safe-area-inset-top))] flex-col gap-4 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:mb-0 md:grid md:min-h-0 md:grid-cols-[1fr_360px] md:items-start md:pb-4'>
      <div className='flex flex-col gap-3'>
        <div className='flex items-center gap-2 pt-2'>
          <Button
            variant='ghost'
            size='icon'
            className='-ms-2 md:hidden'
            aria-label={t('menu')}
            onClick={() => navigate({ to: '/' })}
          >
            <ArrowLeft className='h-5 w-5 rtl:rotate-180' />
          </Button>
          <h1 className='text-2xl font-bold tracking-tight'>{t('cart')}</h1>
          {/* Mobile-app parity: trash in the header clears the whole cart */}
          <Button
            variant='ghost'
            size='icon'
            className='ms-auto'
            aria-label={t('clearCart')}
            onClick={() => setClearConfirmOpen(true)}
          >
            <Trash2 className='h-5 w-5' />
          </Button>
        </div>

        {lines.map((line) => {
          const key = lineKey(line)
          const customizationsLabel = line.customizations
            .map((c) =>
              language === 'ar' && c.optionNameAr
                ? c.optionNameAr
                : c.optionNameEn,
            )
            .join(' · ')
          return (
            <div
              key={key}
              className='flex items-center gap-3 border-b py-3 last:border-b-0'
            >
              <ImageWithFallback
                src={line.pictureUrl}
                className='h-14 w-14 shrink-0 rounded-lg'
                fallbackIcon={
                  <Coffee className='text-muted-foreground/40 h-5 w-5' />
                }
              />
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='truncate text-sm font-semibold'>
                    {language === 'ar' && line.nameAr
                      ? line.nameAr
                      : line.nameEn}
                  </span>
                </div>
                {customizationsLabel && (
                  <div className='text-muted-foreground truncate text-xs'>
                    {customizationsLabel}
                  </div>
                )}
                {line.specialInstructions && (
                  <div className='text-muted-foreground truncate text-xs italic'>
                    "{line.specialInstructions}"
                  </div>
                )}
                <div className='text-sm font-bold'>
                  {price(line.price * line.quantity)}
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-7 rounded-full'
                  aria-label='Decrease'
                  onClick={() => setQuantity(key, line.quantity - 1)}
                >
                  {line.quantity === 1 ? (
                    <Trash2 className='text-destructive h-3.5 w-3.5' />
                  ) : (
                    <Minus className='h-3.5 w-3.5' />
                  )}
                </Button>
                <span className='w-5 text-center text-sm font-semibold tabular-nums'>
                  {line.quantity}
                </span>
                <Button
                  variant='outline'
                  size='icon'
                  className='size-7 rounded-full'
                  aria-label='Increase'
                  onClick={() => setQuantity(key, line.quantity + 1)}
                >
                  <Plus className='h-3.5 w-3.5' />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* One flat summary section (bordered card only on desktop); mt-auto
          sinks it to the bottom on mobile, mirroring the app's spaceBetween */}
      <div className='mt-auto flex flex-col gap-4 md:mt-0 md:rounded-xl md:border md:p-4 md:pt-4'>
        {tableUnconfirmed && activePlace ? (
          <StillHereCard place={activePlace} />
        ) : (
          destination ? (
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <PlaceIcon kind={destination.placeKind} className='h-4 w-4' />
              {localized(destination.name)}
            </div>
          ) : (
            ((isGuest && guestOrdersAnywhere) || cloudKitchen) && (
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                <ShoppingBag className='h-4 w-4' />
                {/* "No table" means nothing where there never are tables */}
                {t(cloudKitchen ? 'orderToCollect' : 'guestOrderToCollect')}
              </div>
            )
          )
        )}

        <Textarea
          rows={2}
          placeholder={t('orderNoteOptional')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {promoCode ? (
          <div className='flex items-center gap-2 text-sm'>
            <Tag
              className={`h-4 w-4 shrink-0 ${promoReason ? 'text-destructive' : 'text-primary'}`}
            />
            <div className='flex min-w-0 flex-1 flex-col'>
              <span className='font-semibold'>{promoCode}</span>
              {promoReason && (
                <span className='text-destructive text-xs'>
                  {t(promoReasonKey(promoReason))}
                </span>
              )}
            </div>
            {promoQuery.isFetching ? (
              <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
            ) : (
              <Button
                variant='ghost'
                size='icon'
                className='size-7'
                aria-label={t('removePromo')}
                onClick={clearPromo}
              >
                <X className='h-4 w-4' />
              </Button>
            )}
          </div>
        ) : (
          <form
            className='flex gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              const code = promoInput.trim().toUpperCase()
              if (code) setPromoCode(code)
            }}
          >
            <Input
              placeholder={t('promoCode')}
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              className='uppercase'
              autoCapitalize='characters'
              autoComplete='off'
            />
            <Button type='submit' variant='outline' disabled={!promoInput.trim()}>
              {t('apply')}
            </Button>
          </form>
        )}

        {loyaltyOn && auth.isAuthenticated && maxRedeemable > 0 && (
          <div className='flex flex-col gap-3 border-t pt-4'>
            <div className='flex items-center justify-between'>
              <span className='flex items-center gap-2 text-sm font-semibold'>
                <Award className='text-primary h-4 w-4' />
                {t('useLoyaltyPoints')}
              </span>
              <Switch
                checked={redeemActive}
                onCheckedChange={(checked) => {
                  setRedeemEnabled(checked)
                  setPointsToRedeem(
                    checked ? Math.min(POINTS_STEP, maxRedeemable) : 0,
                  )
                }}
              />
            </div>
            {redeemActive && (
              <>
                <Slider
                  min={0}
                  max={maxRedeemable}
                  step={POINTS_STEP}
                  value={[pointsToRedeem]}
                  onValueChange={([value]) => setPointsToRedeem(value)}
                />
                <div className='flex items-center justify-between text-sm'>
                  <span className='tabular-nums'>
                    {pointsToRedeem} {t('pts')}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {pointsBalance} {t('pts')}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div className='space-y-1 border-t pt-4'>
          {(discount > 0 || promoDiscount > 0) && (
            <div className='text-muted-foreground flex items-center justify-between text-sm'>
              <span>{t('subtotal')}</span>
              <span className='tabular-nums'>{price(subtotal)}</span>
            </div>
          )}
          {promoDiscount > 0 && (
            <div className='flex items-center justify-between text-sm text-green-600 dark:text-green-500'>
              <span>{t('promoDiscount')}</span>
              <span className='tabular-nums'>−{price(promoDiscount)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className='flex items-center justify-between text-sm text-green-600 dark:text-green-500'>
              <span>{t('pointsDiscount')}</span>
              <span className='tabular-nums'>−{price(discount)}</span>
            </div>
          )}
          <div className='flex items-center justify-between text-lg font-bold'>
            <span>{t('total')}</span>
            <span className='tabular-nums'>{price(total)}</span>
          </div>
        </div>

        {/* App parity: the button flows right under the total on mobile too */}
        {checkoutButton}
      </div>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clearCartQuestion')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() => clear()}
            >
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
