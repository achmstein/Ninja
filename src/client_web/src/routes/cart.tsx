import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  ArrowLeft,
  Armchair,
  Award,
  Coffee,
  Gamepad2,
  Loader2,
  LogIn,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { createOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import {
  getAccountOptions,
  getPointsValueOptions,
} from '@/api/loyalty/@tanstack/react-query.gen'
import { saveUserPreferencesMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ImageWithFallback } from '@/components/image-fallback'
import { useProfileGate } from '@/components/profile-gate'
import { useGuestGate } from '@/components/guest-gate'
import { SignInSheet } from '@/components/sign-in-options'
import { cartTotal, lineKey, useCart } from '@/lib/cart'
import { useOrderDestination } from '@/lib/order-destination'
import { useGuestStore } from '@/stores/guest-store'
import { useTableStore } from '@/stores/table-store'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const stampOrdered = useTableStore((s) => s.stampOrdered)
  // Room-beats-table lives in useOrderDestination so the header chip and this
  // payload can never disagree about where the order is going
  const destination = useOrderDestination()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()
  // Checking out without an account: the same name and phone, kept on the
  // order instead of on a profile
  const { ensureGuestDetails, guestGateDialog } = useGuestGate()
  const ensureGuestId = useGuestStore((s) => s.ensureGuestId)
  const isGuest = !auth.isAuthenticated

  const { lines, setQuantity, clear } = useCart()
  const [note, setNote] = useState('')
  const [signInOpen, setSignInOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [redeemEnabled, setRedeemEnabled] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)

  const userId = auth.user?.profile?.sub ?? ''

  // Loyalty balance (a customer may not have an account yet; treat as 0)
  const { data: loyaltyAccount } = useQuery({
    ...getAccountOptions({
      path: { userId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: auth.isAuthenticated && !!userId && lines.length > 0,
    retry: false,
  })
  const pointsBalance = Number(loyaltyAccount?.pointsBalance ?? 0)

  const subtotal = cartTotal(lines)
  // Mobile parity: at most 100 points per EGP of the order total
  const maxRedeemable = Math.min(
    pointsBalance,
    Math.floor(subtotal * POINTS_PER_EGP)
  )

  const effectivePoints = redeemEnabled ? pointsToRedeem : 0
  const debouncedPoints = useDebounced(effectivePoints, 300)

  const pointsValueQuery = useQuery({
    ...getPointsValueOptions({
      query: { 'api-version': API_VERSION, points: debouncedPoints },
    }),
    enabled: debouncedPoints > 0,
  })

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
  const total = subtotal - discount

  const savePreferences = useMutation(saveUserPreferencesMutation())

  // Idempotency: the request id must survive retries of the SAME checkout,
  // so a resubmit after a timeout (where the server actually processed the
  // first attempt) is deduplicated server-side instead of creating a
  // duplicate order. A new id is only issued when the payload changes.
  const requestIdRef = useRef<{ signature: string; id: string } | null>(null)

  const placeOrder = useMutation({
    ...createOrderMutation(),
    onSuccess: () => {
      // The order landed — the next checkout is a new logical request
      requestIdRef.current = null
      // Keep the table alive through a long sitting with several rounds
      stampOrdered()
      // Remember the chosen customizations for next time (mobile parity).
      // Preferences hang off an account, so there is nothing to save for a guest.
      const customized = auth.isAuthenticated
        ? lines.filter(
            (line) => !line.bundleId && line.customizations.length > 0
          )
        : []
      if (customized.length > 0) {
        savePreferences.mutate({
          body: {
            items: customized.map((line) => ({
              catalogItemId: line.productId,
              selectedOptions: line.customizations.map((c) => ({
                customizationId: c.customizationId,
                optionId: c.optionId,
              })),
            })),
          },
          query: { 'api-version': API_VERSION },
        })
      }
      clear()
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
      toast.success(t('orderPlacedSuccessfully'))
      navigate({ to: '/orders' })
    },
    onError: () => toast.error(t('failedToPlaceOrder')),
  })

  const handleCheckout = async () => {
    // Both paths ask for a name and a reachable phone; only where they are
    // stored differs. A guest that dismisses the dialog has not ordered.
    const guestContact = isGuest ? await ensureGuestDetails() : null
    if (isGuest && !guestContact) return
    if (!isGuest && !(await ensureProfileComplete())) return

    const profile = auth.user?.profile
    // Minted on the first order that needs it, so browsers that only browse
    // are never tagged. Set before the request so the interceptor sends it.
    const guestId = isGuest ? ensureGuestId() : null

    // Same payload → same request id, so retrying a timed-out submit is
    // deduplicated server-side instead of creating a duplicate order
    const signature = JSON.stringify({
      lines: lines.map((line) => [
        line.productId,
        line.quantity,
        line.specialInstructions,
        line.customizations.map((c) => [c.customizationId, c.optionId]),
      ]),
      note: note.trim(),
      points: discount > 0 ? debouncedPoints : 0,
      // Signing in mid-cart makes it a different order, not a retry
      guest: guestId,
      // Moving between a table and a room makes it a different order, not a
      // retry of the previous one
      destination: destination
        ? [destination.kind, destination.kind === 'table' ? destination.id : 0]
        : null,
    })
    if (
      !requestIdRef.current ||
      requestIdRef.current.signature !== signature
    ) {
      requestIdRef.current = { signature, id: crypto.randomUUID() }
    }

    placeOrder.mutate({
      body: {
        // The server identifies the customer from the token (or, for a guest,
        // the X-Guest-Id header) and ignores these — they stay for the shape
        userId: profile?.sub ?? '',
        userName: profile?.name || profile?.preferred_username || '',
        guestName: guestContact?.name ?? null,
        guestPhone: guestContact?.phone ?? null,
        // Deliver to the customer's running room session, if any
        roomName:
          destination?.kind === 'room'
            ? {
                en: destination.name.en ?? '',
                ar: destination.name.ar ?? null,
              }
            : null,
        tableId: destination?.kind === 'table' ? destination.id : null,
        tableName:
          destination?.kind === 'table'
            ? {
                en: destination.name.en ?? '',
                ar: destination.name.ar ?? null,
              }
            : null,
        customerNote: note.trim() || null,
        // Loyalty needs an account to redeem against; the server rejects a
        // guest order that claims either
        pointsToRedeem: !isGuest && discount > 0 ? debouncedPoints : 0,
        loyaltyDiscount: isGuest ? 0 : discount,
        items: lines.map((line) => ({
          id: crypto.randomUUID(),
          productId: line.productId,
          productName: { en: line.nameEn, ar: line.nameAr || null },
          unitPrice: line.price,
          quantity: line.quantity,
          pictureUrl: line.pictureUrl ?? null,
          specialInstructions: line.specialInstructions ?? null,
          selectedCustomizations: line.customizations.map((c) => ({
            customizationId: c.customizationId,
            customizationName: {
              en: c.customizationNameEn,
              ar: c.customizationNameAr ?? null,
            },
            optionId: c.optionId,
            optionName: { en: c.optionNameEn, ar: c.optionNameAr ?? null },
            priceAdjustment: c.priceAdjustment,
          })),
        })),
      },
      headers: { 'x-requestid': requestIdRef.current.id },
      query: { 'api-version': API_VERSION },
    })
  }

  if (lines.length === 0) {
    return (
      <div className='flex h-[70svh] flex-col items-center justify-center gap-3 text-center'>
        <ShoppingBag className='text-muted-foreground/40 h-10 w-10' />
        <p className='text-muted-foreground'>{t('yourCartIsEmpty')}</p>
        <p className='text-muted-foreground text-sm'>{t('addItemsFromMenu')}</p>
        <Button asChild className='rounded-full px-8'>
          <Link to='/'>{t('browseMenu')}</Link>
        </Button>
      </div>
    )
  }

  // Ordering never needs an account. Signing in is offered underneath rather
  // than in the way, since it is what earns points and keeps the order history.
  const checkoutButton = (
    <div className='flex flex-col gap-2'>
      <Button
        size='lg'
        className='w-full rounded-full'
        disabled={placeOrder.isPending}
        onClick={handleCheckout}
      >
        {placeOrder.isPending && (
          <Loader2 className='me-2 h-4 w-4 animate-spin' />
        )}
        {isGuest ? t('orderAsGuest') : t('placeOrder')}
      </Button>
      {isGuest && (
        <Button
          variant='ghost'
          size='sm'
          className='w-full rounded-full'
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
    <div className='-mb-20 flex min-h-[calc(100svh-env(safe-area-inset-top))] flex-col gap-4 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:mb-0 md:grid md:min-h-0 md:grid-cols-[1fr_360px] md:items-start md:pb-4'>
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
                : c.optionNameEn
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
                  line.bundleId ? (
                    <Package className='text-muted-foreground/40 h-5 w-5' />
                  ) : (
                    <Coffee className='text-muted-foreground/40 h-5 w-5' />
                  )
                }
              />
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='truncate text-sm font-semibold'>
                    {language === 'ar' && line.nameAr
                      ? line.nameAr
                      : line.nameEn}
                  </span>
                  {line.bundleId && (
                    <Badge variant='secondary' className='text-[10px]'>
                      {t('deals')}
                    </Badge>
                  )}
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
                  {line.originalPrice && (
                    <span className='text-muted-foreground ms-1 text-xs font-normal line-through'>
                      {price(line.originalPrice * line.quantity)}
                    </span>
                  )}
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
        {destination?.kind === 'room' ? (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Gamepad2 className='h-4 w-4' />
            {localized(destination.name)}
          </div>
        ) : destination ? (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Armchair className='h-4 w-4' />
            {localized(destination.name)}
          </div>
        ) : null}

        <Textarea
          rows={2}
          placeholder={t('orderNoteOptional')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {/* Where the points slider sits for a signed-in customer — the one
            place the upsell lands without nagging */}
        {isGuest && (
          <div className='text-muted-foreground flex items-center gap-2 border-t pt-4 text-sm'>
            <Award className='text-primary h-4 w-4 shrink-0' />
            {t('guestOrderNoPoints')}
          </div>
        )}

        {auth.isAuthenticated && maxRedeemable > 0 && (
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
                    checked ? Math.min(POINTS_STEP, maxRedeemable) : 0
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
          {discount > 0 && (
            <>
              <div className='text-muted-foreground flex items-center justify-between text-sm'>
                <span>{t('subtotal')}</span>
                <span className='tabular-nums'>{price(subtotal)}</span>
              </div>
              <div className='flex items-center justify-between text-sm text-green-600 dark:text-green-500'>
                <span>{t('pointsDiscount')}</span>
                <span className='tabular-nums'>−{price(discount)}</span>
              </div>
            </>
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
            <AlertDialogTitle>{t('clearCart')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('removeAllItemsFromCart')}
            </AlertDialogDescription>
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

      {profileGateDialog}
      {guestGateDialog}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  )
}
