import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Copy, Download, ExternalLink, Link2, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { defaultApiOrigin, useBrand, useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoTip } from '@/components/info-tip'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { CONNECTOR_FILE } from '@/features/branches/components/print-connectors'

/**
 * The native till and kitchen display, and how a tablet gets them: one
 * generic build of each from the platform's download page, then the
 * connect code, which is nothing more than this business's API host. The
 * web versions stay a link away for iPads and for a browser on anything.
 * One app shows at a time, with one code: the download's or the connect
 * code, whichever step is picked.
 */
/** A camera opens only a full URL; the platform's download page may be given relative to this host. */
function absoluteUrl(url: string): string {
  return new URL(url, window.location.href).href
}

type AppKey = 'pos' | 'kds' | 'connector'

export function AppsPage() {
  const t = useT()
  const brand = useBrand()
  const features = useFeatures()
  const apiUrl = brand?.apiUrl ?? defaultApiOrigin()
  const appsUrl = brand?.appsUrl ?? null
  const [selected, setSelected] = useState<AppKey>('pos')

  // Each app's launcher icon (the platform's N mark on its own tile), the one a tablet shows once installed
  const tablets = [
    {
      key: 'pos' as const,
      icon: '/apps/pos.svg',
      tab: t('appsTabTill'),
      title: t('appsPosTitle'),
      about: t('appsPosAbout'),
      file: 'ninja-pos.apk',
    },
    {
      key: 'kds' as const,
      icon: '/apps/kds.svg',
      tab: t('appsTabKitchen'),
      title: t('appsKdsTitle'),
      about: t('appsKdsAbout'),
      file: 'ninja-kds.apk',
    },
    // The kitchen display is a module: no tab for it when it is off
  ].filter((app) => app.key !== 'kds' || features.kds)

  // The kitchen's printer on a Windows PC goes with the kitchen display
  const tabs = features.kds ? 3 : 1

  return (
    <Main>
      <PageHeader title={t('appsNav')} description={t('appsDescription')} />

      <Tabs
        value={selected}
        onValueChange={(v) => setSelected(v as AppKey)}
        className='gap-4'
      >
        {tabs > 1 && (
          <TabsList className='h-auto w-full sm:w-fit'>
            {tablets.map((app) => (
              <TabsTrigger
                key={app.key}
                value={app.key}
                className='gap-2 px-3 py-1.5'
              >
                <img src={app.icon} alt='' className='size-5 rounded' />
                {app.tab}
              </TabsTrigger>
            ))}
            <TabsTrigger value='connector' className='gap-2 px-3 py-1.5'>
              <Printer className='size-4' />
              {t('appsTabPrinter')}
            </TabsTrigger>
          </TabsList>
        )}

        {tablets.map((app) => (
          <TabsContent key={app.key} value={app.key}>
            <TabletApp
              icon={app.icon}
              title={app.title}
              about={app.about}
              downloadUrl={appsUrl ? `${appsUrl}/${app.file}` : null}
              webUrl={staffOrigin(app.key)}
              apiUrl={apiUrl}
            />
          </TabsContent>
        ))}

        {features.kds && (
          <TabsContent value='connector'>
            <PrinterConnector
              downloadUrl={appsUrl ? `${appsUrl}/${CONNECTOR_FILE}` : null}
            />
          </TabsContent>
        )}
      </Tabs>
    </Main>
  )
}

function staffOrigin(app: 'pos' | 'kds') {
  const { protocol, host } = window.location
  return `${protocol}//${host.replace(/^admin\./, `${app}.`)}`
}

/** The app's name and its one line, above its steps. */
function AppHeader({
  icon,
  title,
  about,
}: {
  icon: React.ReactNode
  title: string
  about: React.ReactNode
}) {
  return (
    <div className='flex items-center gap-4 px-5 pt-5'>
      {icon}
      <div className='min-w-0 flex-1'>
        <h2 className='text-lg font-semibold tracking-tight'>{title}</h2>
        <div className='text-muted-foreground text-sm'>{about}</div>
      </div>
    </div>
  )
}

type Step = 'install' | 'connect'

/**
 * A tablet app in two steps, install and connect, beside the one code the
 * picked step needs: the download for the tablet's camera, or the connect
 * code the app scans on first open.
 */
function TabletApp({
  icon,
  title,
  about,
  downloadUrl,
  webUrl,
  apiUrl,
}: {
  icon: string
  title: string
  about: string
  downloadUrl: string | null
  webUrl: string
  apiUrl: string
}) {
  const t = useT()
  // With no download published here, only the connect code has something to show
  const [step, setStep] = useState<Step>(downloadUrl ? 'install' : 'connect')
  const qr =
    step === 'install' && downloadUrl
      ? { value: absoluteUrl(downloadUrl), caption: t('appsScanToDownload') }
      : { value: apiUrl, caption: t('appsScanToConnect') }

  const copyAddress = () => {
    navigator.clipboard.writeText(apiUrl)
    toast.success(t('appsAddressCopied'))
  }

  return (
    <section className='bg-card overflow-hidden rounded-xl shadow-sm'>
      <AppHeader
        icon={
          <img src={icon} alt='' className='size-12 rounded-xl shadow-xs' />
        }
        title={title}
        about={about}
      />

      <div className='grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start'>
        <ol className='space-y-2'>
          <StepRow
            n={1}
            title={t('appsStepInstall')}
            active={step === 'install'}
            onSelect={downloadUrl ? () => setStep('install') : undefined}
          >
            <div className='flex flex-wrap items-center gap-2'>
              {downloadUrl ? (
                <Button asChild>
                  <a href={downloadUrl}>
                    <Download />
                    {t('appsDownloadAndroid')}
                  </a>
                </Button>
              ) : (
                <Button disabled title={t('appsNotPublishedHere')}>
                  <Download />
                  {t('appsDownloadAndroid')}
                </Button>
              )}
              <Button variant='outline' asChild>
                <a href={webUrl} target='_blank' rel='noreferrer'>
                  <ExternalLink />
                  {t('appsOpenWeb')}
                </a>
              </Button>
              <InfoTip>{t('appsIosHint')}</InfoTip>
            </div>
          </StepRow>

          <StepRow
            n={2}
            title={t('appsConnectTitle')}
            hint={t('appsConnectHint')}
            active={step === 'connect'}
            onSelect={() => setStep('connect')}
          >
            <div className='bg-muted/50 flex items-center gap-2 rounded-lg border p-1.5 ps-3'>
              <code
                dir='ltr'
                className='min-w-0 flex-1 text-left font-mono text-sm break-all'
              >
                {apiUrl.replace(/^https?:\/\//, '')}
              </code>
              <Button variant='outline' size='sm' onClick={copyAddress}>
                <Copy />
                {t('copy')}
              </Button>
            </div>
          </StepRow>
        </ol>

        {/* The one code on the page: it follows the picked step */}
        <figure className='bg-muted/40 flex flex-col items-center gap-3 rounded-xl p-5 md:w-64'>
          <div
            key={qr.value}
            className='animate-in fade-in-0 zoom-in-95 rounded-xl bg-white p-3 shadow-sm duration-300'
          >
            <QRCodeSVG
              value={qr.value}
              size={168}
              level='M'
              marginSize={1}
              bgColor='#ffffff'
              fgColor='#000000'
            />
          </div>
          <figcaption className='text-muted-foreground text-center text-sm text-balance'>
            {qr.caption}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/** A numbered step; picking it brings its code up beside it. */
function StepRow({
  n,
  title,
  hint,
  active,
  onSelect,
  children,
}: {
  n: number
  title: string
  hint?: string
  active: boolean
  onSelect?: () => void
  children: React.ReactNode
}) {
  return (
    <li
      className={cn(
        'rounded-xl border p-4 transition-colors',
        active && onSelect
          ? 'border-foreground/20 bg-muted/40'
          : 'border-transparent'
      )}
    >
      <div className='mb-3 flex items-center gap-1'>
        <button
          type='button'
          onClick={onSelect}
          disabled={!onSelect}
          aria-pressed={active}
          className='focus-visible:ring-ring/50 flex items-center gap-3 rounded-md text-start outline-none focus-visible:ring-[3px] disabled:cursor-default'
        >
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground border'
            )}
          >
            {n}
          </span>
          <span className='text-sm font-medium'>{title}</span>
        </button>
        {hint && <InfoTip>{hint}</InfoTip>}
      </div>
      <div className='ps-10'>{children}</div>
    </li>
  )
}

/** The kitchen's printer on a Windows PC: a download here, a pairing link from the branch's kitchen. */
function PrinterConnector({ downloadUrl }: { downloadUrl: string | null }) {
  const t = useT()
  return (
    <section className='bg-card overflow-hidden rounded-xl shadow-sm'>
      <AppHeader
        icon={
          <span className='bg-muted grid size-12 shrink-0 place-items-center rounded-xl'>
            <Printer className='text-muted-foreground size-6' />
          </span>
        }
        title={t('appsConnectorTitle')}
        about={
          <span className='inline-flex items-center gap-1'>
            {t('appsConnectorShort')}
            <InfoTip>{t('appsConnectorAbout')}</InfoTip>
          </span>
        }
      />
      <ol className='space-y-2 p-5'>
        <StepRow n={1} title={t('appsConnectorInstall')} active>
          {downloadUrl ? (
            <Button asChild>
              <a href={downloadUrl}>
                <Download />
                {t('appsDownloadWindows')}
              </a>
            </Button>
          ) : (
            <Button disabled title={t('appsNotPublishedHere')}>
              <Download />
              {t('appsDownloadWindows')}
            </Button>
          )}
        </StepRow>
        <StepRow n={2} title={t('appsConnectorPairStep')} active>
          <Button variant='outline' asChild>
            <Link to='/branches'>
              <Link2 />
              {t('appsConnectorPair')}
            </Link>
          </Button>
        </StepRow>
      </ol>
    </section>
  )
}
