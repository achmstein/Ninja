import { Link } from '@tanstack/react-router'
import { Copy, Download, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { defaultApiOrigin, useBrand, useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { SettingRow, SettingsCard } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { CONNECTOR_FILE } from '@/features/branches/components/print-connectors'

/**
 * The native till and kitchen display, and how a tablet gets them: one
 * generic build of each from the platform's download page, then the
 * connect code below, which is nothing more than this business's API host. The
 * web versions stay a link away for iPads and for a browser on anything.
 */
/** A camera opens only a full URL; the platform's download page may be given relative to this host. */
function absoluteUrl(url: string): string {
  return new URL(url, window.location.href).href
}

export function AppsPage() {
  const t = useT()
  const brand = useBrand()
  const features = useFeatures()
  const apiUrl = brand?.apiUrl ?? defaultApiOrigin()
  const appsUrl = brand?.appsUrl ?? null
  const staffOrigin = (app: 'pos' | 'kds') => {
    const { protocol, host } = window.location
    return `${protocol}//${host.replace(/^admin\./, `${app}.`)}`
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(apiUrl)
    toast.success(t('appsAddressCopied'))
  }

  // Each app's launcher icon (the platform's N mark on its own tile), the one a tablet shows once installed
  const apps = [
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
    // The kitchen display is a module: no card for it when it is off
  ].filter((app) => app.key !== 'kds' || features.kds)

  return (
    <Main>
      <PageHeader title={t('appsNav')} description={t('appsDescription')} />

      <div className='grid gap-4 sm:grid-cols-2'>
        {apps.map((app) => (
          <SettingsCard
            key={app.key}
            className='flex flex-col'
            title={
              <span className='flex items-center gap-3'>
                <img src={app.icon} alt='' className='size-9 rounded-lg' />
                {app.title}
              </span>
            }
            description={app.about}
          >
            {/* Scanned with the tablet's camera, it opens the download straight away: nothing to type */}
            {appsUrl && (
              <div className='flex items-center gap-4 px-5 py-4'>
                <div className='shrink-0 rounded-md border bg-white p-1.5'>
                  <QRCodeSVG
                    value={absoluteUrl(`${appsUrl}/${app.file}`)}
                    size={88}
                    level='M'
                    marginSize={0}
                    bgColor='#ffffff'
                    fgColor='#000000'
                  />
                </div>
                <p className='text-muted-foreground text-sm'>
                  {t('appsScanToDownload')}
                </p>
              </div>
            )}
            <div className='flex flex-wrap gap-2 px-5 py-4'>
              {appsUrl ? (
                <Button asChild>
                  <a href={`${appsUrl}/${app.file}`}>
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
                <a href={staffOrigin(app.key)} target='_blank' rel='noreferrer'>
                  {t('appsOpenWeb')}
                </a>
              </Button>
            </div>
          </SettingsCard>
        ))}
      </div>

      {/* The kitchen's printer on a Windows PC: a download here, a pairing link from the branch's kitchen */}
      {features.kds && (
        <SettingsCard>
          <SettingRow
            icon={Printer}
            title={t('appsConnectorTitle')}
            description={t('appsConnectorAbout')}
            control={
              <div className='flex flex-wrap gap-2'>
                {appsUrl ? (
                  <Button asChild>
                    <a href={`${appsUrl}/${CONNECTOR_FILE}`}>
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
                <Button variant='outline' asChild>
                  <Link to='/branches'>{t('appsConnectorPair')}</Link>
                </Button>
              </div>
            }
          />
        </SettingsCard>
      )}

      {/* The connect code: the app scans it (or the staff type the address) once, on first open */}
      <SettingsCard
        title={t('appsConnectTitle')}
        description={t('appsConnectHint')}
      >
        <div className='flex flex-col gap-5 px-5 py-4 sm:flex-row sm:items-center'>
          <div className='mx-auto shrink-0 rounded-xl border bg-white p-3 sm:mx-0'>
            <QRCodeSVG
              value={apiUrl}
              size={168}
              level='M'
              marginSize={1}
              bgColor='#ffffff'
              fgColor='#000000'
            />
          </div>
          <div className='min-w-0 flex-1 space-y-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <code className='bg-muted rounded-md px-2 py-1 text-sm' dir='ltr'>
                {apiUrl.replace(/^https?:\/\//, '')}
              </code>
              <Button variant='ghost' size='sm' onClick={copyAddress}>
                <Copy />
                {t('copy')}
              </Button>
            </div>
            <p className='text-muted-foreground text-sm'>{t('appsIosHint')}</p>
          </div>
        </div>
      </SettingsCard>
    </Main>
  )
}
