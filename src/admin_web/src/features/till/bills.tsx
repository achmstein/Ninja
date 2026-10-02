import { getRouteApi } from '@tanstack/react-router'
import { TicketsList } from './components/tickets-list'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/tickets')

/**
 * The bills of a range of business days, on a tab of their own: settled, open
 * and voided, a receipt number finding one. The same list the report opens
 * under its numbers.
 */
export function TillBills() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow } = useTillWindow(search)
  return (
    <TillPage
      tab='bills'
      search={search}
      dayWindow={dayWindow}
      onRangeChange={(next) =>
        navigate({ search: (prev) => ({ ...prev, ...next, page: undefined }) })
      }
    >
      <TicketsList from='/_authenticated/till/tickets' />
    </TillPage>
  )
}
