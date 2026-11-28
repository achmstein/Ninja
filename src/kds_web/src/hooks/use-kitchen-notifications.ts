import { getStoredUser } from '@/config/oidc-config'
import { useStaffHub } from '@ninja/web-core/hub'
import { playAlertSound } from '@ninja/web-core/sound'
import { getActiveBranchId } from '@/stores/branch-store'
import { translate } from '@/lib/i18n'
import { toast } from '@/lib/toast'

type OrderStatusChangedEvent = {
  type?: string
  orderId?: number
  buyerName?: string | null
  branchId?: number
  isReady?: boolean
}

// Order events go to every staff connection, but the board is branch-scoped —
// ringing about an order this screen can never show only confuses the kitchen.
// Events without a branchId (older backend, and the confirmed event today) alert
// everyone.
function isForActiveBranch(event: OrderStatusChangedEvent): boolean {
  return event.branchId == null || event.branchId === getActiveBranchId()
}

const BOARD = ['getKitchenOrders']
// The branch switcher reads names off the branch list
const BRANCHES = ['getBranches']

/**
 * The kitchen's live updates (mounted in the signed-in layout): every
 * OrderStatusChanged refetches the board, with a chime when an order is
 * confirmed (the moment it reaches the kitchen) and when one is cancelled under
 * the kitchen's hands. Another screen's Ready / Bring back arrives the same way,
 * so two screens never disagree for long. The board also keeps a 20s poll, so a
 * silently dead connection can only delay an update, not lose it.
 */
export function useKitchenNotifications() {
  useStaffHub({
    getToken: () => getStoredUser()?.access_token,
    groups: ['JoinAdminGroup'],
    refreshes: {
      OrderStatusChanged: BOARD,
      BranchSettingsChanged: BRANCHES,
    },
    catchUp: [...BOARD, ...BRANCHES],
    on: {
      OrderStatusChanged: (event: OrderStatusChangedEvent) => {
        if (!isForActiveBranch(event)) return
        if (event?.type === 'order_confirmed') {
          const orderId = event.orderId ?? 0
          playAlertSound()
          toast.info(
            event.buyerName
              ? translate('newOrderToastFrom', { orderId, name: event.buyerName })
              : translate('newOrderToast', { orderId })
          )
        }
        // Its bill was voided at the till: the card turns red and stays until it
        // is cleared, and the kitchen is rung, since nobody looks at a card they
        // have already read
        if (event?.type === 'order_voided') {
          playAlertSound()
          toast.error(translate('orderCancelledToast', { orderId: event.orderId ?? 0 }))
        }
      },
    },
  })
}
