import { Download } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/**
 * "Export": the same outline button on every list that can be saved as a
 * spreadsheet. The page decides what goes in the file. Small, as the buttons
 * it sits beside in a page's header are; a default-size one stood taller.
 */
export function ExportButton({
  onExport,
  disabled,
  size = 'sm',
}: {
  onExport: () => void
  disabled?: boolean
  size?: 'default' | 'sm'
}) {
  const t = useT()
  return (
    <Button
      type='button'
      variant='outline'
      size={size}
      onClick={onExport}
      disabled={disabled}
    >
      <Download />
      {t('exportCsv')}
    </Button>
  )
}
