import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getAccountOptions, getPointsValueOptions } from '@/api/loyalty/@tanstack/react-query.gen'
import { quotePromoOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { cartTotal, useCart } from '@/lib/cart'
import { useT } from '@/lib/i18n'
import type { OrderExtras } from '@/lib/order-payload'
import { toast } from '@/lib/toast'
import { useDebounced } from '@/components/cart/savings-model'

/** Mobile parity: at most 100 points per EGP of the order total */
const POINTS_PER_EGP = 100

/**
 * What goes with an order besides its dishes: a note, a promo code, points
 * off. One set of rules wherever the order is sent from, the tray or the
 * order page: the server quotes the code and the points against the live
 * subtotal, and only what it accepted goes with the order.
 */
export function useCheckoutExtras() {
  const t = useT()
  const auth = useAuth()
  // Points are loyalty's: without the module there is no balance to ask for and nothing to redeem
  const { loyalty: loyaltyOn } = useFeatures()
  const lines = useCart((s) => s.lines)
  const [note, setNote] = useState('')
  const [redeemEnabled, setRedeemEnabled] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
  // The code as applied; Catalog quotes it against the live subtotal and redeems it when the order's items check out
  const [promoCode, setPromoCode] = useState<string | null>(null)
  const userId = auth.user?.profile?.sub ?? ''

  // Loyalty balance (a customer may not have an account yet; treat as 0)
  const { data: loyaltyAccount } = useQuery({
    ...getAccountOptions({ path: { userId }, query: { 'api-version': API_VERSION } }),
    enabled: loyaltyOn && auth.isAuthenticated && !!userId && lines.length > 0,
    retry: false,
  })
  const pointsBalance = loyaltyOn ? Number(loyaltyAccount?.pointsBalance ?? 0) : 0

  const subtotal = cartTotal(lines)
  const maxRedeemable = Math.min(pointsBalance, Math.floor(subtotal * POINTS_PER_EGP))

  const effectivePoints = redeemEnabled ? pointsToRedeem : 0
  const debouncedPoints = useDebounced(effectivePoints, 300)

  const pointsValueQuery = useQuery({
    ...getPointsValueOptions({ query: { 'api-version': API_VERSION, points: debouncedPoints } }),
    enabled: debouncedPoints > 0,
  })

  const promoQuery = useQuery({
    ...quotePromoOptions({ query: { 'api-version': API_VERSION, code: promoCode ?? '', subtotal } }),
    enabled: !!promoCode && subtotal > 0,
    retry: false,
  })
  const promoQuote = promoCode ? promoQuery.data : undefined
  const promoDiscount = promoQuote && !promoQuote.reason ? Math.min(Number(promoQuote.discount ?? 0), subtotal) : 0
  const promoReason = promoQuery.isError ? 'error' : (promoQuote?.reason ?? null)

  // The server owns the discount math; on failure redemption is inert until the customer toggles it again
  useEffect(() => {
    if (pointsValueQuery.isError) toast.error(t('anErrorOccurred'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsValueQuery.isError])
  const redeemActive = redeemEnabled && !pointsValueQuery.isError

  const pointsDiscount =
    redeemActive && debouncedPoints > 0 && debouncedPoints === effectivePoints
      ? Math.min(Number(pointsValueQuery.data?.discountValue ?? 0), subtotal)
      : 0
  const total = Math.max(0, subtotal - promoDiscount - pointsDiscount)

  /** What goes with the order: only what the quotes accepted (the server drops a code that no longer applies, and a guest's points never go) */
  const payload = (): OrderExtras => ({
    note,
    points: pointsDiscount > 0 ? debouncedPoints : 0,
    promo: promoDiscount > 0 ? promoCode : null,
    loyaltyDiscount: pointsDiscount,
  })

  /** Sent: a fresh start for the next order */
  const reset = () => {
    setNote('')
    setPromoCode(null)
    setRedeemEnabled(false)
    setPointsToRedeem(0)
  }

  return {
    note,
    setNote,
    promo: { code: promoCode, reason: promoReason, checking: promoQuery.isFetching, apply: setPromoCode, clear: () => setPromoCode(null) },
    points: {
      /** Worth offering: a signed-in member with points that would take something off */
      offered: loyaltyOn && auth.isAuthenticated && maxRedeemable > 0,
      active: redeemActive,
      count: pointsToRedeem,
      max: maxRedeemable,
      balance: pointsBalance,
      setCount: setPointsToRedeem,
      setActive: setRedeemEnabled,
    },
    subtotal,
    promoDiscount,
    pointsDiscount,
    total,
    payload,
    reset,
  }
}

export type CheckoutExtras = ReturnType<typeof useCheckoutExtras>
