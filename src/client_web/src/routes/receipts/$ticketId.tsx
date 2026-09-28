import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { useMyBills } from '@/lib/bills'
import { useLocalized, useT } from '@/lib/i18n'
import { useReceipt } from '@/lib/use-receipt'
import { BillReceipt } from '@/components/bills/receipt-view'
import { NinjaPage } from '@/components/ninja/page/page'
import { RequireAuth } from '@/components/auth/require-auth'
import { useGuestStore } from '@/stores/guest-store'

export const Route = createFileRoute('/receipts/$ticketId')({
  component: ReceiptRoute,
})

/** Open to a guest with a guest id, like the bills page: their bills are
 *  theirs to see. Anyone else is asked to sign in. */
function ReceiptRoute() {
  const auth = useAuth()
  const guestId = useGuestStore((s) => s.guestId)
  if (!auth.isAuthenticated && guestId) return <ReceiptPage />
  return (
    <RequireAuth>
      <ReceiptPage />
    </RequireAuth>
  )
}

/**
 * The bill, on its own page (a link from elsewhere: a stay, the account).
 * Sales says who was on it; anyone else sees the not-found state. Either
 * way it is the paper, rising onto the page.
 */
function ReceiptPage() {
  const { ticketId } = Route.useParams()
  const t = useT()
  const localized = useLocalized()
  const bills = useMyBills()
  const bill = bills.data?.find((b) => Number(b.id) === Number(ticketId))
  // Shares the paper's query, for the title
  const printed = useReceipt(Number(ticketId), bill)
  const title = printed.data
    ? t('receiptNumber', { number: Number(printed.data.receiptNumber) })
    : bill?.receiptNumber != null
      ? t('receiptNumber', { number: Number(bill.receiptNumber) })
      : localized(bill?.locationName) || t('receipt')

  return (
    <NinjaPage title={title} back='/bills'>
      <BillReceipt ticketId={Number(ticketId)} bill={bill} loadingBill={bills.isLoading} />
    </NinjaPage>
  )
}
