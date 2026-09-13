import { Download } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/**
 * "Export": the same outline button on every list that can be saved as a
 * spreadsheet. The page decides what goes in the file.
 */
export function ExportButton({
  onExport,
  disabled,
  size = 'default',
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
      <Download className='me-2 h-4 w-4' />
      {t('exportCsv')}
    </Button>
  )
}
