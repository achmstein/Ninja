import { ChefHat, Copy, Download, ReceiptText, Smartphone } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useBrand } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'

/**
 * The native till and kitchen display, and how a tablet gets them: one
 * generic build of each from the platform's download page, then the
 * connect code below, which is nothing more than this café's API host. The
 * web versions stay a link away for iPads and for a browser on anything.
 */
export function AppsPage() {
  const t = useT()
  const brand = useBrand()
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

  const apps = [
    {
      key: 'pos' as const,
      icon: ReceiptText,
      title: t('appsPosTitle'),
      about: t('appsPosAbout'),
      file: 'ninja-pos.apk',
    },
    {
      key: 'kds' as const,
      icon: ChefHat,
      title: t('appsKdsTitle'),
      about: t('appsKdsAbout'),
      file: 'ninja-kds.apk',
    },
  ]

  return (
    <Main>
      <div className='mx-auto w-full max-w-3xl space-y-6'>
        <PageHeader title={t('appsNav')} description={t('appsDescription')} />

        <div className='grid gap-4 sm:grid-cols-2'>
          {apps.map((app) => (
            <Card key={app.key}>
              <CardContent className='flex h-full flex-col gap-3 pt-6'>
                <div className='flex items-center gap-3'>
                  <div className='bg-muted grid size-10 place-items-center rounded-lg'>
                    <app.icon className='size-5' />
                  </div>
                  <div className='text-base font-semibold'>{app.title}</div>
                </div>
                <p className='text-muted-foreground text-sm'>{app.about}</p>
                <div className='mt-auto flex flex-wrap gap-2 pt-2'>
                  {appsUrl ? (
                    <Button asChild>
                      <a href={`${appsUrl}/${app.file}`}>
                        <Download className='size-4' />
                        {t('appsDownloadAndroid')}
                      </a>
                    </Button>
                  ) : (
                    <Button disabled title={t('appsNotPublishedHere')}>
                      <Download className='size-4' />
                      {t('appsDownloadAndroid')}
                    </Button>
                  )}
                  <Button variant='outline' asChild>
                    <a href={staffOrigin(app.key)} target='_blank' rel='noreferrer'>
                      {t('appsOpenWeb')}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* The connect code: the app scans it (or the staff type the address) once, on first open */}
        <Card>
          <CardContent className='flex flex-col gap-6 pt-6 sm:flex-row sm:items-center'>
            <div className='mx-auto shrink-0 rounded-xl border bg-white p-3'>
              <QRCodeSVG value={apiUrl} size={168} level='M' marginSize={1} bgColor='#ffffff' fgColor='#000000' />
            </div>
            <div className='min-w-0 flex-1 space-y-3'>
              <div className='flex items-center gap-2 text-base font-semibold'>
                <Smartphone className='size-4' />
                {t('appsConnectTitle')}
              </div>
              <p className='text-muted-foreground text-sm'>{t('appsConnectHint')}</p>
              <div className='flex flex-wrap items-center gap-2'>
                <code className='bg-muted rounded-md px-2 py-1 text-sm' dir='ltr'>
                  {apiUrl.replace(/^https?:\/\//, '')}
                </code>
                <Button variant='ghost' size='sm' onClick={copyAddress}>
                  <Copy className='size-4' />
                  {t('copy')}
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>{t('appsIosHint')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Main>
  )
}

/**
 * The API host when the brand does not say: on the platform the café's API
 * is this host with `api.` for its `admin.` label. A dev server has no such
 * host; the AppHost's BFF stands in.
 */
function defaultApiOrigin(): string {
  const { protocol, host } = window.location
  if (host.startsWith('admin.')) return `${protocol}//${host.replace(/^admin\./, 'api.')}`
  return 'http://localhost:5000'
}
