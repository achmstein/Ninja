/** The status dot every order row carries: green once the till confirmed
 *  it, red when cancelled, orange while it is still waiting. Shared by the
 *  orders page and the table's tab so one order never shows two colours. */
export function statusDotClass(status: string | undefined | null): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'bg-green-600 dark:bg-green-500'
    case 'cancelled':
      return 'bg-destructive'
    default:
      return 'bg-orange-500'
  }
}
