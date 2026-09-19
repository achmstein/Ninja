import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { createPortal } from 'react-dom'
import { useBrand, useBrandName, useCustomerOrigin } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

type QrCard = {
  id: string
  name?: { en?: string | null; ar?: string | null } | null
  url: string
}

type QrSheetProps = {
  /** Where the back arrow returns to */
  backTo: '/places'
  subtitle: string
  /** Call to action printed under every code, in both languages */
  caption: { en: string; ar: string }
  cards: QrCard[]
  isLoading: boolean
  emptyText: string
}

/** The tenant's logo sitting in the middle of every code, when there is one.
 *  Level H correction tolerates ~30% loss, and the mark covers about 4% of
 *  the code's area, so scanning is unaffected. */
const centerMark = (src: string) => ({
  src,
  height: 40,
  width: 40,
  excavate: true,
})

/** Print-ready QR cards, one per place.
 *
 *  Portalled to <body> so the printed page can hide #root wholesale: the admin
 *  shell, the toasts and the devtools all live in there, and so does the scroll
 *  container whose scrollbar was being painted onto the paper. SVG rather than
 *  canvas keeps the codes sharp at any paper size. */
export function QrSheet({
  backTo,
  subtitle,
  caption,
  cards,
  isLoading,
  emptyText,
}: QrSheetProps) {
  const t = useT()
  const brand = useBrand()
  const brandName = useBrandName()
  const customerHost = new URL(useCustomerOrigin()).host

  return createPortal(
    <div className='qr-sheet bg-background fixed inset-0 z-50 overflow-auto print:static print:overflow-visible'>
      <style>{`
        @page { margin: 12mm; }
        @media print {
          #root, [data-sileo-viewport] { display: none !important; }
          /* Paper is white even when the admin is running in dark mode */
          .qr-sheet { background: #fff !important; color: #000 !important; }
          .qr-sheet-card {
            border-color: #111 !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className='bg-background sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4 print:hidden'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='icon' asChild>
            <Link to={backTo}>
              <ArrowLeft className='h-4 w-4 rtl:rotate-180' />
            </Link>
          </Button>
          <div>
            <h1 className='font-semibold'>{t('printQrSheet')}</h1>
            <p className='text-muted-foreground text-sm'>{subtitle}</p>
          </div>
        </div>

        <Button onClick={() => window.print()}>
          <Printer className='me-2 h-4 w-4' />
          {t('printQrSheet')}
        </Button>
      </div>

      <div className='p-6 print:p-0'>
        {isLoading ? (
          <div className='grid grid-cols-2 gap-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-80 w-full' />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <p className='text-muted-foreground py-12 text-center'>{emptyText}</p>
        ) : (
          <div className='grid grid-cols-2 gap-4'>
            {cards.map((card) => (
              <div
                key={card.id}
                className='qr-sheet-card flex break-inside-avoid flex-col items-center gap-4 rounded-2xl border-2 border-black bg-white p-6 text-center text-black'
              >
                {brand?.logoUrl ? (
                  <img src={brand.logoUrl} alt='' className='h-7 w-auto' />
                ) : (
                  <div className='text-base font-bold tracking-tight'>
                    {brandName}
                  </div>
                )}

                {/* Both languages on the card - staff and customers read either */}
                <div className='leading-tight'>
                  <div className='text-2xl font-bold'>{card.name?.en}</div>
                  {card.name?.ar && (
                    <div className='text-xl font-semibold' dir='rtl'>
                      {card.name.ar}
                    </div>
                  )}
                </div>

                <div className='rounded-xl border border-black/15 bg-white p-3'>
                  <QRCodeSVG
                    value={card.url}
                    size={180}
                    // H (not M): the centre mark eats modules the reader has
                    // to reconstruct
                    level='H'
                    marginSize={1}
                    bgColor='#ffffff'
                    fgColor='#000000'
                    imageSettings={
                      brand?.logoUrl ? centerMark(brand.logoUrl) : undefined
                    }
                  />
                </div>

                <div className='leading-tight'>
                  <div className='text-sm font-medium'>{caption.en}</div>
                  <div className='text-sm font-medium' dir='rtl'>
                    {caption.ar}
                  </div>
                </div>

                {/* Typed by hand when a camera will not cooperate */}
                <div className='text-[11px] tracking-[0.2em] text-black/60 uppercase'>
                  {customerHost}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
