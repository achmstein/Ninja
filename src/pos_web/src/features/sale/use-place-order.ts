import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { createPosOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import { useBranchName } from '@/features/branch/use-branch-name'
import { customerName, ensureCounterCustomer } from '@/features/customer/counter-customers'
import { useDeliveryActions } from '@/features/deliveries/use-deliveries'
import { useOfflineCharge } from '@/features/offline/offline-charge'
import { saveCustomerPreferences, startSend } from '@/features/sending/sending'
import { useCallCentre } from '@/hooks/use-call-centre'
import { API_VERSION } from '@/lib/api-client'
import { handleServerError } from '@/lib/handle-server-error'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { isConnectionError, useNetworkStatus } from '@/lib/network-status'
import { toast } from '@/lib/toast'
import { getActiveBranchId } from '@/stores/branch-store'
import { toBasketItems } from './basket-items'
import { lineKey, useSale, type SaleCustomer, type SaleLine } from './cart'
import { sendToBranchId, toPosDeliveryRequest } from './sale-delivery'
import { useBranchPriceCheck, type PriceReview } from './use-branch-price-check'
import type { useSaleDelivery } from './use-sale-delivery'

/** How long a charge waits for the server before the sale is taken offline */
const CHARGE_TIMEOUT_MS = 20_000

/**
 * Sending what was rung up, every way the till does it:
 *
 * - a **round** onto an open bill, for whoever Send was told it is for: the
 *   bill shows it at once, faded until the server has it (features/sending);
 * - a **counter sale**: the same way onto a bill of its own, then straight to
 *   its payment; offline, it is taken here and sent once the server is back;
 * - a **delivery** or a **call-centre order**: placed and waited for, since
 *   they have no bill on this till to show themselves on. A caller with no
 *   account becomes a customer as their order goes.
 */
export function usePlaceOrder({
  ticketId,
  saleDelivery,
  onBeforeCharge,
}: {
  /** The open bill rounds are rung onto; none for a new sale */
  ticketId: number | undefined
  saleDelivery: ReturnType<typeof useSaleDelivery>
  /** The phone's order sheet closes first: the wait paints under an open sheet otherwise */
  onBeforeCharge: () => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const branchName = useBranchName()
  const { lines, note, customer, setCustomer, removeLines, clear } = useSale()
  const { delivery, delivering } = saleDelivery
  const deliveryActions = useDeliveryActions()
  // Sent to the branch nearer the caller: its menu is checked first, and the
  // order goes there with nothing on this branch's bills
  const sendTo = sendToBranchId(delivery)
  const priceCheck = useBranchPriceCheck()
  // Taken at the call centre: nothing is paid here, and the next caller follows
  const callCentre = useCallCentre().on
  const [priceReview, setPriceReview] = useState<PriceReview | null>(null)
  // A new caller is being added to the customers, a moment before their order goes
  const [addingCaller, setAddingCaller] = useState(false)
  const online = useNetworkStatus((s) => s.online)

  // The request id must survive retries of the SAME sale, so a resubmit after
  // a timeout (where the server actually processed the first attempt) is
  // deduplicated instead of ringing the customer up twice. A new id is only
  // issued when the sale's content changes.
  const requestIdRef = useRef<{ signature: string; id: string } | null>(null)
  const requestIdFor = (toSend: SaleLine[]) => {
    const signature = JSON.stringify({
      lines: toSend.map((line) => [
        line.productId,
        line.quantity,
        line.specialInstructions,
        line.customizations.map((c) => [c.customizationId, c.optionId]),
      ]),
      note: note.trim(),
      // Attaching (or removing) a customer makes it a different sale, not a
      // retry of the previous one — a bare name counts too
      customer: customer?.id ?? customer?.name ?? null,
      // And sent somewhere else, another sale again
      delivery,
    })
    if (!requestIdRef.current || requestIdRef.current.signature !== signature) {
      requestIdRef.current = { signature, id: crypto.randomUUID() }
    }
    return requestIdRef.current.id
  }

  const landed = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
  }

  /** What Ordering is told for these lines and this person */
  const bodyFor = (toSend: SaleLine[], who: SaleCustomer | null) => ({
    items: toBasketItems(toSend),
    customerNote: note.trim() || null,
    // No bill named: a counter sale, settled at the till. A round names its
    // bill outright, and Sales appends to it
    ticketId: ticketId ?? null,
    // The account, only when there is one: it is what loyalty accrues to and
    // what an on-account settle charges
    customerUserId: who?.id ?? null,
    customerUserName: who?.id ? who.name : null,
    // The name always travels, account or not: the kitchen card and the bill line both carry it
    customerName: who?.name ?? null,
    // Redemption at the counter is a later phase; accrual happens server-side off the attached customer
    pointsToRedeem: 0,
    // Where it goes; the pin only when the caller shared one
    delivery: delivery ? toPosDeliveryRequest(delivery) : null,
    // The branch nearer the caller that makes and delivers it
    sendToBranchId: sendTo,
  })

  // With the server out of reach, a counter sale is still taken: priced here,
  // paid here, printed here, and sent once the server is back
  // (features/offline). Anything that needs the server's say first waits.
  const offlineCharge = useOfflineCharge()
  const sellsOffline = ticketId === undefined && !delivering && !callCentre && sendTo == null && !customer?.id
  const chargeOffline = () => {
    if (!sellsOffline) {
      toast.warning(t('needsInternet'))
      return
    }
    offlineCharge.start({
      // The id an online attempt already used: if that one did land after
      // all, the replay is recognised as it rather than sold twice
      requestId: requestIdFor(lines),
      lines,
      note,
      customerName: customer?.name.trim() || null,
      onQueued: () => {
        requestIdRef.current = null
        clear()
      },
    })
  }

  const placeOrder = useMutation({
    ...createPosOrderMutation(),
    onError: (error) => {
      // No answer at all: the server is out of reach, and this is how the
      // till usually finds out — the sale is taken offline instead
      if (isConnectionError(error)) chargeOffline()
      else handleServerError(error)
    },
    onSuccess: (data) => {
      // The attached customer's choices, kept before the cart is cleared below
      if (customer?.id) saveCustomerPreferences(customer.id, lines)
      // The order landed: the next charge is a new logical request
      requestIdRef.current = null
      const orderId = toNumber(data.orderId)
      const again = orderId === 0

      // A delivery is a bill of its own, settled when the rider's cash comes
      // in: nothing to pay now. The rider picked in the form is given it at
      // once; without one it is given from Deliveries on the floor
      if (delivering) {
        const rider = sendTo == null && !again ? (delivery?.rider ?? null) : null
        clear()
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getDeliveries' }] })
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        if (rider) deliveryActions.assign(orderId, rider.userId)
        toast.success(
          again
            ? t('orderAlreadyPlaced')
            : sendTo != null
              ? t('deliverySentTo', { branch: branchName(sendTo), orderId })
              : rider
                ? t('deliveryPlacedRider', { name: rider.name })
                : t('deliveryPlaced'),
        )
        navigate({ to: '/' })
        return
      }

      // A caller collecting at the branch: their bill waits at its counter,
      // paid when they come for it; the call centre takes the next call
      if (callCentre) {
        clear()
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        toast.success(
          again ? t('orderAlreadyPlaced') : t('callCentrePickupPlaced', { branch: branchName(getActiveBranchId()), orderId }),
        )
        navigate({ to: '/' })
      }
    },
  })

  /** Places the sale with these lines: the cart's, or the other branch's prices of them */
  const send = (toSend: SaleLine[]) => {
    const requestId = requestIdFor(toSend)
    const body = bodyFor(toSend, customer)

    // A walk-in's new bill shows the lines at once, faded until the server
    // has them, on the way to its payment (features/sending)
    if (!delivering && !callCentre) {
      void startSend({ requestId, ticketId: null, branchId: getActiveBranchId(), lines: toSend, note, customer, body }).then(
        (outcome) => {
          if (outcome.kind === 'alreadyPlaced') toast.info(t('orderAlreadyPlaced'))
          if (outcome.kind !== 'failed') landed()
        },
      )
      requestIdRef.current = null
      clear()
      navigate({ to: '/ticket/sending/$requestId', params: { requestId } })
      return
    }

    const place = (as: typeof body) =>
      placeOrder.mutate({
        body: as,
        headers: { 'x-requestid': requestId },
        query: { 'api-version': API_VERSION },
        // A line that has gone quiet answers nothing for minutes: past this,
        // the sale is taken offline (and the same request id keeps a late
        // arrival from becoming a second sale)
        timeout: CHARGE_TIMEOUT_MS,
      })

    // A caller with no account yet becomes a customer as their order goes:
    // the number is the customer, so the next call finds them, with their
    // points and what they ordered. Never holds the order up: when it cannot
    // be done the order goes as a guest's
    const callerPhone = delivery?.phone || customer?.phone || ''
    if (!customer?.id && customer?.name.trim() && callerPhone) {
      setAddingCaller(true)
      void ensureCounterCustomer(customer.name.trim(), callerPhone)
        .then((added) => {
          if (!added) return place(body)
          const name = customerName(added) || customer.name
          setCustomer({ id: added.id, name, phone: added.phoneNumber ?? callerPhone })
          place({ ...body, customerUserId: added.id, customerUserName: name })
        })
        .finally(() => setAddingCaller(false))
      return
    }
    place(body)
  }

  return {
    /** A counter sale, a delivery or a call-centre order: everything on the sale goes */
    charge: () => {
      if (!online) return chargeOffline()
      // A delivery waits for its terms: it never goes out as a counter sale
      if (delivering && saleDelivery.readiness !== 'ready') return
      // A rider needs a name at the door: taken off the sale, it is asked again
      if (delivering && !customer?.name.trim()) return saleDelivery.setFormOpen(true)
      onBeforeCharge()
      if (sendTo != null) {
        // The other branch's menu first: its prices, and what it ran out of
        priceCheck
          .check(sendTo, lines)
          .then((review) => (review.items.length === 0 ? send(lines) : setPriceReview(review)))
          .catch(() => toast.error(t('priceCheckFailed', { branch: branchName(sendTo) })))
        return
      }
      send(lines)
    },
    /**
     * A round (or a part of one) onto the open bill, for this person or for
     * nobody. The bill shows it at once; what was not sent stays on the sale.
     * False when it could not go, so nothing is taken off the sale
     */
    sendRound: (part: SaleLine[], who: SaleCustomer | null): boolean => {
      if (ticketId === undefined || part.length === 0) return false
      if (!online) {
        toast.warning(t('needsInternet'))
        return false
      }
      void startSend({
        requestId: crypto.randomUUID(),
        ticketId,
        branchId: getActiveBranchId(),
        lines: part,
        note,
        customer: who,
        body: bodyFor(part, who),
      }).then((outcome) => {
        if (outcome.kind === 'alreadyPlaced') toast.info(t('orderAlreadyPlaced'))
        if (outcome.kind !== 'failed') landed()
      })
      removeLines(part.map(lineKey))
      return true
    },
    /** A blocking wait for what has no bill here to show itself on, and what it says */
    busy: placeOrder.isPending || priceCheck.checking || addingCaller,
    busyText: priceCheck.checking ? t('priceChecking', { branch: branchName(sendTo) }) : t('sendingToKitchen'),
    pending: placeOrder.isPending,
    /** The other branch's prices of the sale, for the cashier to look over before it is sent there */
    priceReview: {
      review: priceReview,
      branch: branchName(sendTo),
      close: () => setPriceReview(null),
      use: (adjusted: SaleLine[]) => {
        setPriceReview(null)
        send(adjusted)
      },
      /** Made here after all: the cashier charges again, at this branch's fee */
      keepHere: () => {
        setPriceReview(null)
        if (delivery) saleDelivery.keepHere()
      },
    },
    offlineElement: offlineCharge.element,
  }
}
