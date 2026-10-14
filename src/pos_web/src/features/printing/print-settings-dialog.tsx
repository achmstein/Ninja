import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, Download, Printer, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useBrand, useBrandName } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { connectorStatus, openDrawer, printImage } from './connector'
import { usePrintSettings } from './print-settings'
import { sheetImage } from './sheet-image'

/** The installer every business downloads; pairing it in admin is what makes it theirs */
const CONNECTOR_FILE = 'ninja-print-connector.exe'

const selectClass =
  'border-input dark:bg-input/30 h-12 w-full rounded-md border bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50'

/**
 * Which of this PC's printers the till prints on, through the print
 * connector installed on it: the receipts (and the drawer behind them), and
 * offline the kitchen's chit. Asking the connector here is also when Edge
 * asks, once, to let the till reach it.
 */
export function PrintSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const brand = useBrand()
  const brandName = useBrandName()
  const settings = usePrintSettings()
  const [busy, setBusy] = useState<'test' | 'drawer' | null>(null)
  const testSheet = useRef<HTMLDivElement>(null)

  const status = useQuery({
    queryKey: ['print-connector-status'],
    queryFn: connectorStatus,
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const connector = status.data ?? null
  // A printer chosen before stays listed even while the connector is away
  const printers = [
    ...new Set([
      ...(connector?.printers ?? []),
      ...[settings.receiptPrinter, settings.kitchenPrinter].filter(
        (p): p is string => !!p,
      ),
    ]),
  ]
  const download = brand?.appsUrl ? `${brand.appsUrl}/${CONNECTOR_FILE}` : null

  const run = async (kind: 'test' | 'drawer') => {
    const printer = settings.receiptPrinter
    if (!printer) return
    setBusy(kind)
    try {
      if (kind === 'test' && testSheet.current) {
        await printImage(printer, await sheetImage(testSheet.current), false)
      } else {
        await openDrawer(printer)
      }
      toast.success(t('testPrintSent'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('printingSettings')}</DialogTitle>
          <DialogDescription>{t('printingSettingsHint')}</DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <div className='flex items-start gap-3 rounded-lg border p-3'>
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-2.5 shrink-0 rounded-full',
                connector ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
            />
            <div className='flex min-w-0 flex-1 flex-col gap-1 text-sm'>
              {status.isFetching ? (
                <span className='text-muted-foreground'>…</span>
              ) : connector ? (
                <span className='font-medium'>
                  {t('printConnectorFound', {
                    name: connector.name,
                    version: connector.version,
                  })}
                </span>
              ) : (
                <>
                  <span className='font-medium'>{t('printConnectorMissing')}</span>
                  <span className='text-muted-foreground'>
                    {t('printConnectorInstallHint')}
                  </span>
                  {download && (
                    <a
                      href={download}
                      className='text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline'
                    >
                      <Download className='size-4' />
                      {t('printConnectorInstall')}
                    </a>
                  )}
                </>
              )}
              <span className='text-muted-foreground text-xs'>
                {t('printConnectorAllowHint')}
              </span>
            </div>
            <Button
              variant='ghost'
              size='icon'
              className='size-10 shrink-0'
              onClick={() => void status.refetch()}
              aria-label={t('refresh')}
            >
              <RotateCw className={cn('size-4', status.isFetching && 'animate-spin')} />
            </Button>
          </div>

          <label className='flex flex-col gap-1.5 text-sm font-medium'>
            {t('receiptPrinter')}
            <select
              className={selectClass}
              value={settings.receiptPrinter ?? ''}
              onChange={(e) => settings.setReceiptPrinter(e.target.value || null)}
            >
              <option value=''>{t('noReceiptPrinter')}</option>
              {printers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className='flex flex-col gap-1.5 text-sm font-medium'>
            {t('kitchenChitPrinter')}
            <select
              className={selectClass}
              value={settings.kitchenPrinter ?? ''}
              disabled={!settings.receiptPrinter}
              onChange={(e) => settings.setKitchenPrinter(e.target.value || null)}
            >
              <option value=''>{t('sameAsReceiptPrinter')}</option>
              {printers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className='flex min-h-12 items-center justify-between gap-3 text-sm font-medium'>
            {t('openDrawerOnCash')}
            <Switch
              checked={settings.drawerOnCash}
              disabled={!settings.receiptPrinter}
              onCheckedChange={settings.setDrawerOnCash}
            />
          </label>

          <div className='grid grid-cols-2 gap-2'>
            <Button
              variant='outline'
              className='h-12 gap-2'
              disabled={!settings.receiptPrinter || !connector || busy !== null}
              onClick={() => void run('test')}
            >
              <Printer className='size-5' />
              {t('testPrint')}
            </Button>
            <Button
              variant='outline'
              className='h-12 gap-2'
              disabled={!settings.receiptPrinter || !connector || busy !== null}
              onClick={() => void run('drawer')}
            >
              <Banknote className='size-5' />
              {t('openDrawer')}
            </Button>
          </div>
        </div>

        {/* What the test print prints: drawn off screen, never shown */}
        <div ref={testSheet} style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }}>
            {brandName}
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, margin: '2mm 0' }}>
            {t('testPrint')}
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />
          <div style={{ textAlign: 'center' }}>{t('testPrintBody')}</div>
          <div style={{ textAlign: 'center', fontSize: 11, marginTop: '2mm' }}>
            {new Date().toLocaleString()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
