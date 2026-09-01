import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { listTablesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { tableQrUrl } from './qr'

/** Print-ready QR cards, one per active table.
 *
 *  Rendered as a fixed overlay so the admin shell (sidebar, header) is not part
 *  of the printed page, and SVG rather than canvas so the codes stay sharp at
 *  any paper size. */
export function TableQrSheet() {
  const t = useT()
  const { data: tables = [], isLoading } = useQuery(listTablesOptions())

  // A deactivated table should not be inviting orders from a printed card
  const printable = tables.filter((table) => table.isActive)

  return (
    <div className='bg-background fixed inset-0 z-50 overflow-auto'>
      <style>{`
        @media print {
          .qr-sheet-chrome { display: none !important; }
          .qr-sheet-page { padding: 0 !important; }
          .qr-sheet-card { break-inside: avoid; page-break-inside: avoid; }
        }
        @page { margin: 12mm; }
      `}</style>

      <div className='qr-sheet-chrome bg-background sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='icon' asChild>
            <Link to='/tables'>
              <ArrowLeft className='h-4 w-4 rtl:rotate-180' />
            </Link>
          </Button>
          <div>
            <h1 className='font-semibold'>{t('printQrSheet')}</h1>
            <p className='text-muted-foreground text-sm'>
              {t('qrSheetSubtitle')}
            </p>
          </div>
        </div>

        <Button onClick={() => window.print()}>
          <Printer className='me-2 h-4 w-4' />
          {t('printQrSheet')}
        </Button>
      </div>

      <div className='qr-sheet-page p-6'>
        {isLoading ? (
          <div className='grid grid-cols-2 gap-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-64 w-full' />
            ))}
          </div>
        ) : printable.length === 0 ? (
          <p className='text-muted-foreground py-12 text-center'>
            {t('noTablesYet')}
          </p>
        ) : (
          <div className='grid grid-cols-2 gap-4'>
            {printable.map((table) => (
              <div
                key={table.id}
                className='qr-sheet-card flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center'
              >
                {/* Both languages on the card - staff and customers read either */}
                <div className='text-xl font-bold text-black'>
                  {table.name?.en}
                </div>
                {table.name?.ar && (
                  <div className='text-lg font-semibold text-black' dir='rtl'>
                    {table.name.ar}
                  </div>
                )}

                <QRCodeSVG
                  value={tableQrUrl(Number(table.id))}
                  size={180}
                  level='M'
                  bgColor='#ffffff'
                  fgColor='#000000'
                />

                <div className='text-sm text-black'>{t('scanToOrder')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
