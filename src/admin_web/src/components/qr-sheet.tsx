import { Link } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { createPortal } from 'react-dom'
import { useBrand, useBrandName, useCustomerOrigin } from '@/lib/brand'
import { wordmarkFor } from '@/lib/brand-slots'
import { useLanguage, useT } from '@/lib/i18n'
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

/** The code's drawn size; everything over it is a share of this, so the code
 *  and its mark scale together when a phone's column is narrower. */
const QR_SIZE = 180

/** The hole cut in the middle of the code for the business's logo: a clear
 *  square a little larger than the logo's tile, so no module touches it. 52
 *  of 180 is about 8% of the code's area; level H rebuilds up to ~30%. The
 *  image is a transparent pixel: the hole is all the code needs, and the logo
 *  is drawn over it as HTML, on its own white rounded tile. */
const HOLE = 52
const TILE = 44
const clearHole = {
  src: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  height: HOLE,
  width: HOLE,
  excavate: true,
}

/** Print-ready QR cards, one per place.
 *
 *  Portalled to <body> so the printed page can hide #root wholesale: the admin
 *  shell, the toasts and the devtools all live in there, and so does the scroll
 *  container whose scrollbar was being painted onto the paper. SVG rather than
 *  canvas keeps the codes sharp at any paper size. */
export function QrSheet({ backTo, subtitle, caption, cards, isLoading, emptyText }: QrSheetProps) {
  const t = useT()
  const brand = useBrand()
  const brandName = useBrandName()
  const language = useLanguage((s) => s.language)
  // Paper is white: the business's light wordmark, else its logo, else its name
  const wordmark = wordmarkFor(brand, language, 'light')
  const logo = brand?.logoUrl ?? null
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
          <Printer />
          {t('printQrSheet')}
        </Button>
      </div>

      <div className='p-6 print:p-0'>
        {isLoading ? (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-80 w-full' />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <p className='text-muted-foreground py-12 text-center'>{emptyText}</p>
        ) : (
          // One card a row on a phone (two ran into each other there), two
          // from sm up and always two on paper
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2'>
            {cards.map((card) => (
              <div
                key={card.id}
                className='qr-sheet-card flex min-w-0 break-inside-avoid flex-col items-center gap-4 rounded-2xl border-2 border-black bg-white p-6 text-center text-black'
              >
                {wordmark ? (
                  <img src={wordmark.url} alt='' className='h-8 w-auto max-w-[70%] object-contain' />
                ) : logo ? (
                  <img src={logo} alt='' className='size-10 rounded-[22%] object-cover' />
                ) : (
                  <div className='text-base font-bold tracking-tight'>{brandName}</div>
                )}

                {/* Both languages on the card - staff and customers read either */}
                <div className='leading-tight'>
                  {/* A place named in one language shows that name once */}
                  <div className='text-2xl font-bold'>{card.name?.en || card.name?.ar}</div>
                  {card.name?.en && card.name?.ar && (
                    <div className='text-xl font-semibold' dir='rtl'>
                      {card.name.ar}
                    </div>
                  )}
                </div>

                <div className='w-full max-w-[204px] rounded-xl border border-black/15 bg-white p-3'>
                  <div className='relative'>
                    <QRCodeSVG
                      value={card.url}
                      size={QR_SIZE}
                      // H (not M): the centre mark eats modules the reader has
                      // to reconstruct
                      level={logo ? 'H' : 'M'}
                      marginSize={1}
                      bgColor='#ffffff'
                      fgColor='#000000'
                      imageSettings={logo ? clearHole : undefined}
                      className='block h-auto w-full'
                    />
                    {logo && (
                      // The logo on a white tile with rounded corners, in
                      // the cleared middle, its own shape kept
                      <div
                        className='absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[22%] bg-white p-[3%] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]'
                        style={{
                          width: `${(TILE / QR_SIZE) * 100}%`,
                          height: `${(TILE / QR_SIZE) * 100}%`,
                        }}
                      >
                        <img src={logo} alt='' className='size-full rounded-[18%] object-contain' />
                      </div>
                    )}
                  </div>
                </div>

                <div className='leading-tight'>
                  <div className='text-sm font-medium'>{caption.en}</div>
                  <div className='text-sm font-medium' dir='rtl'>
                    {caption.ar}
                  </div>
                </div>

                {/* Typed by hand when a camera will not cooperate */}
                <div className='text-[11px] tracking-[0.2em] text-black/60 uppercase'>{customerHost}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
