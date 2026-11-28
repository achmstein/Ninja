import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Copy, Download, ExternalLink, Link2, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { defaultApiOrigin, useBrand, useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { EntitySheet } from '@/components/entity-sheet'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { CONNECTOR_FILE } from '@/features/branches/components/print-connectors'
import { getAllBranchesOptions } from './api/queries'

/**
 * The native till, kitchen display and rider app, and the kitchen's printer
 * connector: how a device gets each. A plain list, one row an app; a tap
 * opens the app's two steps in a sheet (from the bottom on a phone), each
 * with its code in plain view for the device's camera: the download, then
 * the connect code (this business's API host) the app scans on first open.
 * The web versions stay a link away for iPads and a browser on anything.
 */
/** A camera opens only a full URL; the platform's download page may be given relative to this host. */
function absoluteUrl(url: string): string {
  return new URL(url, window.location.href).href
}

type AppKey = 'pos' | 'kds' | 'rider' | 'connector'

type NativeApp = {
  key: 'pos' | 'kds' | 'rider'
  icon: string
  title: string
  about: string
  file: string
}

export function AppsPage() {
  const t = useT()
  const brand = useBrand()
  const features = useFeatures()
  const apiUrl = brand?.apiUrl ?? defaultApiOrigin()
  const appsUrl = brand?.appsUrl ?? null
  const [open, setOpen] = useState<AppKey | null>(null)
  // The rider app is for a business whose branches deliver with their own riders
  const branchesQuery = useQuery({
    ...getAllBranchesOptions(),
    // Only asked whether a branch delivers where the business does at all
    enabled: features.delivery === true,
  })
  const delivers = features.delivery && (branchesQuery.data ?? []).some((b) => b.isDeliveryEnabled)

  // Each app's launcher icon (the platform's N mark on its own tile), the one a device shows once installed
  const apps: NativeApp[] = [
    {
      key: 'pos' as const,
      icon: '/apps/pos.svg',
      title: t('appsPosTitle'),
      about: t('appsPosAbout'),
      file: 'ninja-pos.apk',
    },
    {
      key: 'kds' as const,
      icon: '/apps/kds.svg',
      title: t('appsKdsTitle'),
      about: t('appsKdsAbout'),
      file: 'ninja-kds.apk',
    },
    {
      key: 'rider' as const,
      icon: '/apps/rider.svg',
      title: t('appsRiderTitle'),
      about: t('appsRiderAbout'),
      file: 'ninja-rider.apk',
    },
    // The kitchen display is a module, and the rider app is for delivering branches: no row for either otherwise
  ].filter((app) => (app.key !== 'kds' || features.kds) && (app.key !== 'rider' || delivers))
  const picked = apps.find((app) => app.key === open)

  return (
    <Main>
      <PageHeader title={t('appsNav')} description={t('appsDescription')} />

      <ul className='bg-card divide-y overflow-hidden rounded-xl shadow-sm'>
        {apps.map((app) => (
          <AppRow
            key={app.key}
            icon={<img src={app.icon} alt='' className='size-11 rounded-xl shadow-xs' />}
            title={app.title}
            about={app.about}
            onOpen={() => setOpen(app.key)}
          />
        ))}
        {/* The kitchen's printer on a Windows PC goes with the kitchen display */}
        {features.kds && (
          <AppRow
            icon={
              <span className='bg-muted grid size-11 shrink-0 place-items-center rounded-xl'>
                <Printer className='text-muted-foreground size-5' />
              </span>
            }
            title={t('appsConnectorTitle')}
            about={t('appsConnectorShort')}
            onOpen={() => setOpen('connector')}
          />
        )}
      </ul>

      {picked && (
        <EntitySheet
          open={open === picked.key}
          onOpenChange={(o) => !o && setOpen(null)}
          title={picked.title}
          subtitle={picked.about}
        >
          <NativeAppSteps
            downloadUrl={appsUrl ? `${appsUrl}/${picked.file}` : null}
            // The rider app has no web version: riders are on Android phones
            webUrl={picked.key === 'rider' ? null : staffOrigin(picked.key)}
            apiUrl={apiUrl}
          />
        </EntitySheet>
      )}

      {features.kds && (
        <EntitySheet
          open={open === 'connector'}
          onOpenChange={(o) => !o && setOpen(null)}
          title={t('appsConnectorTitle')}
          subtitle={t('appsConnectorAbout')}
        >
          <ConnectorSteps downloadUrl={appsUrl ? `${appsUrl}/${CONNECTOR_FILE}` : null} />
        </EntitySheet>
      )}
    </Main>
  )
}

function staffOrigin(app: 'pos' | 'kds') {
  const { protocol, host } = window.location
  return `${protocol}//${host.replace(/^admin\./, `${app}.`)}`
}

/** One app in the list: its icon, its name and line, and the way into it. */
function AppRow({
  icon,
  title,
  about,
  onOpen,
}: {
  icon: React.ReactNode
  title: string
  about: string
  onOpen: () => void
}) {
  return (
    <li>
      <button
        type='button'
        onClick={onOpen}
        className='hover:bg-muted/50 focus-visible:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-start outline-none'
      >
        {icon}
        <span className='min-w-0 flex-1'>
          <span className='block font-medium'>{title}</span>
          <span className='text-muted-foreground line-clamp-2 block text-sm'>{about}</span>
        </span>
        <ChevronRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' />
      </button>
    </li>
  )
}

/**
 * An Android app's two steps, each with what does it: the download (its
 * code for the device's camera, and the button for when this page is open
 * on the device itself), then the connect code the app scans on first open,
 * with the address under it to type or copy.
 */
function NativeAppSteps({
  downloadUrl,
  webUrl,
  apiUrl,
}: {
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
    <ol className='space-y-6'>
      <Step n={1} title={t('appsStepInstall')}>
        {downloadUrl && <Code value={absoluteUrl(downloadUrl)} caption={t('appsScanToDownload')} />}
        {downloadUrl ? (
          <Button asChild className='w-full'>
            <a href={downloadUrl}>
              <Download />
              {t('appsDownloadAndroid')}
            </a>
          </Button>
        ) : (
          <Button disabled className='w-full'>
            <Download />
            {t('appsDownloadAndroid')}
          </Button>
        )}
        {!downloadUrl && <p className='text-muted-foreground text-sm'>{t('appsNotPublishedHere')}</p>}
        {webUrl && (
          <>
            <Button variant='outline' asChild className='w-full'>
              <a href={webUrl} target='_blank' rel='noreferrer'>
                <ExternalLink />
                {t('appsOpenWeb')}
              </a>
            </Button>
            <p className='text-muted-foreground text-sm'>{t('appsIosHint')}</p>
          </>
        )}
      </Step>

      <Step n={2} title={t('appsConnectTitle')} hint={t('appsConnectHint')}>
        <Code value={apiUrl} caption={t('appsScanToConnect')} />
        <div className='bg-muted/50 flex items-center gap-2 rounded-lg border p-1.5 ps-3'>
          <code dir='ltr' className='min-w-0 flex-1 truncate text-left font-mono text-sm'>
            {apiUrl.replace(/^https?:\/\//, '')}
          </code>
          <Button variant='outline' size='sm' onClick={copyAddress}>
            <Copy />
            {t('copy')}
          </Button>
        </div>
      </Step>
    </ol>
  )
}

/** The kitchen's printer on a Windows PC: a download here, a pairing link from the branch's kitchen. */
function ConnectorSteps({ downloadUrl }: { downloadUrl: string | null }) {
  const t = useT()
  return (
    <ol className='space-y-6'>
      <Step n={1} title={t('appsConnectorInstall')}>
        {downloadUrl ? (
          <Button asChild className='w-full'>
            <a href={downloadUrl}>
              <Download />
              {t('appsDownloadWindows')}
            </a>
          </Button>
        ) : (
          <>
            <Button disabled className='w-full'>
              <Download />
              {t('appsDownloadWindows')}
            </Button>
            <p className='text-muted-foreground text-sm'>{t('appsNotPublishedHere')}</p>
          </>
        )}
      </Step>
      <Step n={2} title={t('appsConnectorPairStep')}>
        <Button variant='outline' asChild className='w-full'>
          <Link to='/branches'>
            <Link2 />
            {t('appsConnectorPair')}
          </Link>
        </Button>
      </Step>
    </ol>
  )
}

/** A numbered step: its number and what to do, then what does it, full width under it. */
function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <li className='space-y-3'>
      <div className='flex items-center gap-2.5'>
        <span className='bg-foreground text-background grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums'>
          {n}
        </span>
        <span className='font-medium'>{title}</span>
      </div>
      {hint && <p className='text-muted-foreground text-sm'>{hint}</p>}
      {children}
    </li>
  )
}

/** A code in plain view, for a device's camera, with what scanning it does. */
function Code({ value, caption }: { value: string; caption: string }) {
  return (
    <figure className='flex flex-col items-center gap-2'>
      <div className='rounded-xl border bg-white p-3'>
        <QRCodeSVG value={value} size={176} level='M' marginSize={1} bgColor='#ffffff' fgColor='#000000' />
      </div>
      <figcaption className='text-muted-foreground text-center text-sm text-balance'>{caption}</figcaption>
    </figure>
  )
}
