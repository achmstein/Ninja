import { entitledTo, useBrand } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { ErrorState } from '@/components/error-state'

/**
 * Online payments are an add-on: its settings exist once the café has bought
 * it, whether or not the owner has switched it on yet (setting up the
 * account comes first). A URL typed by hand without it lands here.
 */
export function OnlinePaymentsGate({ children }: { children: React.ReactNode }) {
  const t = useT()
  const brand = useBrand()

  if (brand && !entitledTo(brand, 'onlinePayments')) {
    return (
      <ErrorState
        size='page'
        code={403}
        title={t('notInPlan')}
        description={t('featureOffDescription')}
        home
      />
    )
  }

  return <>{children}</>
}
