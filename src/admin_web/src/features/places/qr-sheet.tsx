import { useQuery } from '@tanstack/react-query'
import { listPlacesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { bilingual, useLocalized, useT } from '@/lib/i18n'
import { placeQrUrl } from '@/lib/qr'
import { QrSheet } from '@/components/qr-sheet'
import { comparePlaces } from './status'

/** One printed card per place: rooms, then tables, then stations. */
export function PlaceQrSheet() {
  const t = useT()
  const localized = useLocalized()
  const { data: places = [], isLoading } = useQuery(listPlacesOptions())

  // A closed place should not be inviting anyone from a printed card; one
  // that is out of service keeps its card — the code stays on its door
  const cards = places
    .filter((place) => place.isActive)
    .sort(comparePlaces(localized))
    .map((place) => ({
      id: String(place.id),
      name: place.name,
      url: placeQrUrl(Number(place.id)),
    }))

  return (
    <QrSheet
      backTo='/places'
      subtitle={t('placeQrSheetSubtitle')}
      caption={bilingual('scanToOrderOrJoin')}
      cards={cards}
      isLoading={isLoading}
      emptyText={t('noPlacesYet')}
    />
  )
}
