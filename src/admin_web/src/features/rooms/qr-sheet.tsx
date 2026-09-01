import { useQuery } from '@tanstack/react-query'
import { listRoomsOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { bilingual, useT } from '@/lib/i18n'
import { roomQrUrl } from '@/lib/qr'
import { QrSheet } from '@/components/qr-sheet'

export function RoomQrSheet() {
  const t = useT()
  const { data: rooms = [], isLoading } = useQuery(listRoomsOptions())

  // Same order as the room list, so a printed stack matches what staff see.
  // A room in maintenance still keeps its card - the code stays on its door.
  const cards = [...rooms]
    .sort((a, b) => (a.name?.en ?? '').localeCompare(b.name?.en ?? ''))
    .map((room) => ({
      id: String(room.id),
      name: room.name,
      url: roomQrUrl(Number(room.id)),
    }))

  return (
    <QrSheet
      backTo='/rooms'
      subtitle={t('roomQrSheetSubtitle')}
      caption={bilingual('scanToJoinRoom')}
      cards={cards}
      isLoading={isLoading}
      emptyText={t('noRoomsYet')}
    />
  )
}
