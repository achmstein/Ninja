import { useIsCloudKitchen } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { ErrorState } from '@/components/error-state'

// Wraps the pages about tables and rooms. A cloud kitchen has none: the
// sidebar leaves their links out, and a URL typed by hand lands here.
export function PlacesGate({ children }: { children: React.ReactNode }) {
  const t = useT()
  const cloudKitchen = useIsCloudKitchen()

  if (cloudKitchen) {
    return (
      <ErrorState
        size='page'
        title={t('noPlacesTitle')}
        description={t('noPlacesDescription')}
        home
      />
    )
  }

  return <>{children}</>
}
