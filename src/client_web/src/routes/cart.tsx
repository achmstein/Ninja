import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { createOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import {
  getAccountOptions,
  getPointsValueOptions,
} from '@/api/loyalty/@tanstack/react-query.gen'
import {
  quotePromoOptions,
  saveUserPreferencesMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
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
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ImageWithFallback } from '@/components/image-fallback'
import { useProfileGate } from '@/components/profile-gate'
import { useGuestGate } from '@/components/guest-gate'
import { SignInSheet } from '@/components/sign-in-options'
import { cartTotal, lineKey, useCart } from '@/lib/cart'
import { useSelectedBranch } from '@/lib/branch'
import { useOrderDestination } from '@/lib/order-destination'
import { PlaceIcon, placeKindName } from '@/lib/places'
import { useGuestStore } from '@/stores/guest-store'
import { useActivePlace, useActivePlaceConfirmed } from '@/stores/place-store'
import { StillHereCard } from '@/components/places/still-here'
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
  // Room-beats-table lives in useOrderDestination so the header chip and this
  // payload can never disagree about where the order is going
  const destination = useOrderDestination()
  const branch = useSelectedBranch()
  // A table carried over from an earlier session is asked about before an
  // order goes to it (docs/visit-tab.html): a stale table is the one way an
  // order-ahead could land on yesterday's seat
  const activePlace = useActivePlace()
  const placeConfirmed = useActivePlaceConfirmed()
  const tableUnconfirmed =
    destination?.kind === 'place' && activePlace != null && !placeConfirmed
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
    enabled: auth.isAuthenticated && !!userId && lines.length > 0,
    retry: false,
  })
  const pointsBalance = Number(loyaltyAccount?.pointsBalance ?? 0)

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
      // Remember the chosen customizations for next time (mobile parity).
      // Preferences hang off an account, so there is nothing to save for a guest.
      const customized = auth.isAuthenticated
        ? lines.filter((line) => line.customizations.length > 0)
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
      navigate({ to: '/bills' })
    },
    onError: () => toast.error(t('failedToPlaceOrder')),
  })

  const handleCheckout = async () => {
    if (tableUnconfirmed) {
      toast.info(t('confirmTableFirst'))
      return
    }
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
      promo: promoDiscount > 0 ? promoCode : null,
      // Signing in mid-cart makes it a different order, not a retry
      guest: guestId,
      // Moving between a table and a room makes it a different order, not a
      // retry of the previous one
      destination: destination
        ? [destination.kind, destination.placeId, destination.sessionId ?? 0]
        : null,
    })
    if (!requestIdRef.current || requestIdRef.current.signature !== signature) {
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
        // Where the order goes: the place, and the customer's running clock
        // there if any, so the server lands it on the right bill.
        placeId: destination?.placeId ?? null,
        placeKind: destination ? placeKindName(destination.placeKind) : null,
        placeName: destination
          ? { en: destination.name.en ?? '', ar: destination.name.ar ?? null }
          : null,
        sessionId: destination?.sessionId ?? null,
        customerNote: note.trim() || null,
        // Only a code the quote accepted; the server drops one that no
        // longer applies rather than failing the order
        promoCode: promoDiscount > 0 ? promoCode : null,
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
  const guestNeedsTable = isGuest && !destination
  // The branch wants a name it can hold to on a table order: a guest at a
  // table signs in first. Ordering refuses it too; this just says so
  // before the tap rather than after.
  const guestNeedsAccount =
    isGuest &&
    destination?.kind === 'place' &&
    (branch?.requireSignInForTableOrders ?? false)

  // Ordering never needs an account. Signing in is offered underneath rather
  // than in the way, since it is what earns points and keeps the order history.
  const checkoutButton =
    guestNeedsTable || guestNeedsAccount ? (
      <div className='flex flex-col gap-3 border-t pt-4'>
        <div className='flex items-start gap-2 text-sm'>
          {guestNeedsAccount ? (
            <LogIn className='text-primary mt-0.5 h-4 w-4 shrink-0' />
          ) : (
            <QrCode className='text-primary mt-0.5 h-4 w-4 shrink-0' />
          )}
          <span>
            {guestNeedsAccount
              ? t('tableOrdersNeedAccount')
              : t('scanTableToOrder')}
          </span>
        </div>
        <Button
          size='lg'
          className='w-full rounded-pill'
          onClick={() => setSignInOpen(true)}
        >
          <LogIn className='h-4 w-4' />
          {t('signIn')}
        </Button>
      </div>
    ) : (
      <div className='flex flex-col gap-2'>
        <Button
          size='lg'
          className='w-full rounded-pill'
          disabled={placeOrder.isPending || tableUnconfirmed}
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
          destination && (
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <PlaceIcon kind={destination.placeKind} className='h-4 w-4' />
              {localized(destination.name)}
            </div>
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

      {profileGateDialog}
      {guestGateDialog}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  )
}
