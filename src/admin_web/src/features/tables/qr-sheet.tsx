import { useQuery } from '@tanstack/react-query'
import { listTablesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { bilingual, useT } from '@/lib/i18n'
import { tableQrUrl } from '@/lib/qr'
import { QrSheet } from '@/components/qr-sheet'

export function TableQrSheet() {
  const t = useT()
  const { data: tables = [], isLoading } = useQuery(listTablesOptions())

  // A deactivated table should not be inviting orders from a printed card
  const cards = tables
    .filter((table) => table.isActive)
    .map((table) => ({
      id: String(table.id),
      name: table.name,
      url: tableQrUrl(Number(table.id)),
    }))

  return (
    <QrSheet
      backTo='/tables'
      subtitle={t('qrSheetSubtitle')}
      caption={bilingual('scanToOrder')}
      cards={cards}
      isLoading={isLoading}
      emptyText={t('noTablesYet')}
    />
  )
}
