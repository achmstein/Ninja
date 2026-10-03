import { useQuery } from '@tanstack/react-query'
import { getRealmRoles } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getOpenReservationsOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  entitledTo,
  useBrand,
  useFeatures,
  useIsCloudKitchen,
} from '@/lib/brand'
import { isOpenReservation } from '@/features/places/status'
import { serviceRequestsService } from '@/features/requests/service'
import { sidebarData } from './data/sidebar-data'
import { type NavGroup, type NavItem } from './types'

/**
 * The navigation this person sees, with its counts: owner-only pages off an
 * admin's, switched-off features off everyone's, tables off a cloud
 * kitchen's, an add-on's setup once bought; a group left with nothing goes
 * too. The sidebar and the phone's More both draw from it.
 */
export function useNavGroups(): NavGroup[] {
  const auth = useAuth()
  const isOwner = getRealmRoles(auth.user).includes('Owner')
  const features = useFeatures()
  const brand = useBrand()
  const cloudKitchen = useIsCloudKitchen()

  // Pending-order count badge on Live, kept fresh by SignalR
  const { data: pendingOrders = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    refetchInterval: 60_000,
  })

  // Open service-request count badge on Live, same freshness
  const { data: serviceRequests = [] } = useQuery({
    queryKey: ['service-requests'],
    queryFn: () => serviceRequestsService.pending(),
    refetchInterval: 60_000,
  })

  // Places held or booked and not yet arrived, on Rooms & Tables: a reservation
  // made from the customer app shows here the moment it lands (RoomStatusChanged
  // refreshes it), whatever page is open
  const { data: reservations = [] } = useQuery({
    ...getOpenReservationsOptions(),
    enabled: features.reservations,
    refetchInterval: 60_000,
  })
  const openReservations = features.reservations
    ? reservations.filter(isOpenReservation).length
    : 0

  const badges: Record<string, number> = {
    '/orders/live': pendingOrders.length + serviceRequests.length,
    '/places': openReservations,
  }

  const withBadge = <T extends { url?: string }>(item: T): T => {
    const count = item.url ? badges[String(item.url)] : undefined
    return count ? { ...item, badge: String(count) } : item
  }

  return sidebarData.navGroups
    .filter((group) => !group.ownerOnly || isOwner)
    .filter((group) => !group.feature || features[group.feature])
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => item.items || !item.ownerOnly || isOwner)
        .filter((item) => item.items || !item.feature || features[item.feature])
        .filter((item) => item.items || !item.needsPlaces || !cloudKitchen)
        .filter(
          (item) =>
            item.items ||
            !item.entitled ||
            (brand != null && entitledTo(brand, item.entitled))
        )
        .map((item): NavItem => {
          if (item.items) {
            return { ...item, items: item.items.map(withBadge) }
          }
          return withBadge(item)
        }),
    }))
    .filter((group) => group.items.length > 0)
}
