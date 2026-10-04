import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Copy,
  Download,
  ExternalLink,
  Link2,
  Printer,
  QrCode,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { getAllBranchesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { defaultApiOrigin, useBrand, useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoTip } from '@/components/info-tip'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { CONNECTOR_FILE } from '@/features/branches/components/print-connectors'

/**
 * The native till, kitchen display and rider app, and how a device gets them: one
 * generic build of each from the platform's download page, then the
 * connect code, which is nothing more than this business's API host. The
 * web versions stay a link away for iPads and for a browser on anything.
 * One app shows at a time, in two plain steps; each step's QR code is a
 * tap away beside it rather than on the page.
 */
/** A camera opens only a full URL; the platform's download page may be given relative to this host. */
function absoluteUrl(url: string): string {
  return new URL(url, window.location.href).href
}

type AppKey = 'pos' | 'kds' | 'rider' | 'connector'

export function AppsPage() {
  const t = useT()
  const brand = useBrand()
  const features = useFeatures()
  const apiUrl = brand?.apiUrl ?? defaultApiOrigin()
  const appsUrl = brand?.appsUrl ?? null
  const [selected, setSelected] = useState<AppKey>('pos')
  // The rider app is for a business whose branches deliver with their own riders
  const branchesQuery = useQuery(getAllBranchesOptions())
  const delivers = (branchesQuery.data ?? []).some((b) => b.isDeliveryEnabled)

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
    {
      key: 'rider' as const,
      icon: '/apps/rider.svg',
      tab: t('appsTabRider'),
      title: t('appsRiderTitle'),
      about: t('appsRiderAbout'),
      file: 'ninja-rider.apk',
    },
    // The kitchen display is a module, and the rider app is for delivering branches: no tab for either otherwise
  ].filter(
    (app) =>
      (app.key !== 'kds' || features.kds) && (app.key !== 'rider' || delivers)
  )

  // The kitchen's printer on a Windows PC goes with the kitchen display
  const tabs = tablets.length + (features.kds ? 1 : 0)

  return (
    <Main>
      <PageHeader title={t('appsNav')} description={t('appsDescription')} />

      <Tabs
        value={selected}
        onValueChange={(v) => setSelected(v as AppKey)}
        className='gap-4'
      >
        {/* On a phone the icon over a short label, so no name runs edge to edge */}
        {tabs > 1 && (
          <TabsList
            className='grid h-auto w-full p-1 sm:inline-flex sm:w-fit'
            style={{ gridTemplateColumns: `repeat(${tabs}, minmax(0, 1fr))` }}
          >
            {tablets.map((app) => (
              <TabsTrigger
                key={app.key}
                value={app.key}
                className='h-auto flex-col gap-1 px-2 py-2 text-xs sm:flex-row sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm'
              >
                <img src={app.icon} alt='' className='size-5 rounded' />
                {app.tab}
              </TabsTrigger>
            ))}
            {features.kds && (
              <TabsTrigger
                value='connector'
                className='h-auto flex-col gap-1 px-2 py-2 text-xs sm:flex-row sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm'
              >
                <Printer className='size-4' />
                {t('appsTabPrinter')}
              </TabsTrigger>
            )}
          </TabsList>
        )}

        {tablets.map((app) => (
          <TabsContent key={app.key} value={app.key}>
            <TabletApp
              icon={app.icon}
              title={app.title}
              about={app.about}
              downloadUrl={appsUrl ? `${appsUrl}/${app.file}` : null}
              // The rider app has no web version: riders are on Android phones
              webUrl={app.key === 'rider' ? null : staffOrigin(app.key)}
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
  webUrl: string | null
  apiUrl: string
}) {
  const t = useT()
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

      <div className='p-5'>
        <ol className='space-y-5'>
          <StepRow n={1} title={t('appsStepInstall')}>
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
              {downloadUrl && (
                <QrButton
                  value={absoluteUrl(downloadUrl)}
                  caption={t('appsScanToDownload')}
                />
              )}
              {webUrl && (
                <Button variant='outline' asChild>
                  <a href={webUrl} target='_blank' rel='noreferrer'>
                    <ExternalLink />
                    {t('appsOpenWeb')}
                  </a>
                </Button>
              )}
              {webUrl && <InfoTip>{t('appsIosHint')}</InfoTip>}
            </div>
          </StepRow>

          <StepRow
            n={2}
            title={t('appsConnectTitle')}
            hint={t('appsConnectHint')}
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
              <QrButton value={apiUrl} caption={t('appsScanToConnect')} small />
            </div>
          </StepRow>
        </ol>
      </div>
    </section>
  )
}

/** A numbered step: its number, what to do, and what does it under it. */
function StepRow({
  n,
  title,
  hint,
  children,
}: {
  n: number
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <li className='flex gap-3'>
      <span className='bg-foreground text-background grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums'>
        {n}
      </span>
      <div className='min-w-0 flex-1 space-y-3 pt-0.5'>
        <div className='flex items-center gap-1'>
          <span className='text-sm font-medium'>{title}</span>
          {hint && <InfoTip>{hint}</InfoTip>}
        </div>
        {children}
      </div>
    </li>
  )
}

/** A QR code a tap away, for the tablet's camera, where its step needs one */
function QrButton({
  value,
  caption,
  small = false,
}: {
  value: string
  caption: string
  small?: boolean
}) {
  const t = useT()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size={small ? 'sm' : 'default'}>
          <QrCode />
          {t('appsShowQr')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='flex w-64 flex-col items-center gap-3'>
        <div className='rounded-xl bg-white p-3 shadow-sm'>
          <QRCodeSVG
            value={value}
            size={180}
            level='M'
            marginSize={1}
            bgColor='#ffffff'
            fgColor='#000000'
          />
        </div>
        <p className='text-muted-foreground text-center text-sm text-balance'>
          {caption}
        </p>
      </PopoverContent>
    </Popover>
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
        <StepRow n={1} title={t('appsConnectorInstall')}>
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
        <StepRow n={2} title={t('appsConnectorPairStep')}>
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
