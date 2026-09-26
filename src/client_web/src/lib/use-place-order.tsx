import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { createOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import { saveUserPreferencesMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'
import { useSelectedBranch } from '@/lib/branch'
import { useCart } from '@/lib/cart'
import { useT } from '@/lib/i18n'
import { useOrderDestination } from '@/lib/order-destination'
import { checkoutBlock, NO_EXTRAS, orderBody, orderSignature, type OrderExtras } from '@/lib/order-payload'
import { toast } from '@/lib/toast'
import { useGuestStore } from '@/stores/guest-store'
import { useActivePlace, useActivePlaceConfirmed } from '@/stores/place-store'
import { useGuestGate } from '@/components/guest-gate'
import { useProfileGate } from '@/components/profile-gate'

/**
 * Placing the cart as an order, the one way every surface does it (the cart
 * page, the Counter's tray): the table asked about first when it was carried
 * over, a guest's name and phone or a complete profile, one request id per
 * payload so a retry is deduplicated, the customer's choices saved for next
 * time, the bills read again and the cart cleared. The caller decides what
 * happens after, and when the cart empties: `onPlaced` gets `finish`, which
 * clears it (the cart page holds its tick for a beat first; the Counter
 * clears at once). Without `onPlaced` the cart clears straight away.
 *
 * Render `dialogs` somewhere on the page: the profile and guest gates open there.
 */
export function usePlaceOrder({
  onPlaced,
  onFailed,
}: { onPlaced?: (finish: () => void) => void; onFailed?: () => void } = {}) {
  const t = useT()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const destination = useOrderDestination()
  const branch = useSelectedBranch()
  const guestOrdersAnywhere = useBrand()?.guestOrdersAnywhere ?? false
  const activePlace = useActivePlace()
  const placeConfirmed = useActivePlaceConfirmed()
  const tableUnconfirmed = destination?.kind === 'place' && activePlace != null && !placeConfirmed
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()
  const { ensureGuestDetails, guestGateDialog } = useGuestGate()
  const ensureGuestId = useGuestStore((s) => s.ensureGuestId)
  const isGuest = !auth.isAuthenticated
  const { lines, clear } = useCart()

  const block = checkoutBlock({
    isGuest,
    destination,
    guestOrdersAnywhere,
    requireSignInForTableOrders: branch?.requireSignInForTableOrders ?? false,
  })

  const savePreferences = useMutation(saveUserPreferencesMutation())
  const requestIdRef = useRef<{ signature: string; id: string } | null>(null)

  const mutation = useMutation({
    ...createOrderMutation(),
    onSuccess: () => {
      requestIdRef.current = null
      // Preferences hang off an account, so there is nothing to save for a guest
      const customized = auth.isAuthenticated ? lines.filter((line) => line.customizations.length > 0) : []
      if (customized.length > 0) {
        savePreferences.mutate({
          body: {
            items: customized.map((line) => ({
              catalogItemId: line.productId,
              selectedOptions: line.customizations.map((c) => ({ customizationId: c.customizationId, optionId: c.optionId })),
            })),
          },
          query: { 'api-version': API_VERSION },
        })
      }
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
      if (onPlaced) onPlaced(clear)
      else clear()
    },
    onError: () => {
      onFailed?.()
      toast.error(t('failedToPlaceOrder'))
    },
  })

  /** Sends the order; resolves false when a gate stopped it before anything was sent. */
  const submit = async (extras: OrderExtras = NO_EXTRAS): Promise<boolean> => {
    if (block) return false
    if (tableUnconfirmed) {
      toast.info(t('confirmTableFirst'))
      return false
    }
    const guestContact = isGuest ? await ensureGuestDetails() : null
    if (isGuest && !guestContact) return false
    if (!isGuest && !(await ensureProfileComplete())) return false

    // Minted on the first order that needs it; set before the request so the interceptor sends it
    const guestId = isGuest ? ensureGuestId() : null
    const signature = orderSignature(lines, extras, guestId, destination)
    if (!requestIdRef.current || requestIdRef.current.signature !== signature) {
      requestIdRef.current = { signature, id: crypto.randomUUID() }
    }
    mutation.mutate({
      body: orderBody({ lines, extras, isGuest, profile: auth.user?.profile, guestContact, destination }),
      headers: { 'x-requestid': requestIdRef.current.id },
      query: { 'api-version': API_VERSION },
    })
    return true
  }

  return {
    submit,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
    block,
    isGuest,
    destination,
    tableUnconfirmed,
    activePlace,
    dialogs: (
      <>
        {profileGateDialog}
        {guestGateDialog}
      </>
    ),
  }
}
