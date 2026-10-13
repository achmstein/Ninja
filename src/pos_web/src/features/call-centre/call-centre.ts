// The pure parts of the call centre: which branch a caller's delivery goes to,
// and what the sale is made of once it is chosen. Kept apart from the screens
// so they can be tested.
import type { DeliveryAlternative } from '@/api/ordering/types.gen'
import type { SaleDelivery } from '@/features/sale/cart'
import { toNumber } from '@/lib/money'

/**
 * The branch the call centre suggests: the nearest one that delivers there
 * and is not paused. The list comes nearest first; a paused branch may still
 * take the order, but only when the agent picks it. Null when none is open.
 */
export function suggestedBranch(branches: readonly DeliveryAlternative[]): number | null {
  const open = branches.find((b) => !b.paused)
  return open ? toNumber(open.branchId) : null
}

/**
 * The branch the caller's order goes to: the agent's own pick while it is
 * still among the branches that deliver there, the suggestion otherwise.
 */
export function chosenBranch(branches: readonly DeliveryAlternative[], picked: number | null): number | null {
  if (picked != null && branches.some((b) => toNumber(b.branchId) === picked)) return picked
  return suggestedBranch(branches)
}

/**
 * The delivery as the sale pad keeps it, at the branch that makes it: the
 * caller's words and the pin read from what they shared. Never sent on to
 * another branch — the till switches to the branch that cooks it.
 */
export function callerDelivery(form: SaleDelivery, pin: { latitude: number; longitude: number } | null): SaleDelivery {
  return {
    ...form,
    address: form.address.trim(),
    latitude: pin?.latitude ?? null,
    longitude: pin?.longitude ?? null,
    // The pin as coordinates: the sale pad's quote reads it back as the same point
    location: pin ? `${pin.latitude}, ${pin.longitude}` : form.location.trim(),
    sendTo: null,
  }
}
