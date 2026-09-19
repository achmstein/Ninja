import { useState } from 'react'
import { ExternalLink, RotateCw } from 'lucide-react'
import { useT, type Language } from '@/lib/i18n'
import type { Scheme } from '@/lib/brand-slots'
import { Button } from '@/components/ui/button'
import { PhoneFrame } from './phone-frame'

/**
 * The real customer app in a phone frame. Language and scheme go in the
 * query string (the app reads them for a preview and keeps nothing), and the
 * frame reloads whenever `version` changes, so a saved brand shows at once.
 * Only the control app may frame a customer site (Caddy's frame-ancestors).
 */
export function LivePreview({
  customerUrl,
  version,
  language,
  scheme,
  className,
}: {
  customerUrl: string
  version: string | number
  language: Language
  scheme: Scheme
  className?: string
}) {
  const t = useT()
  // Bumped by the reload button: the frame starts over at the app's home
  const [reloads, setReloads] = useState(0)
  const url = new URL(customerUrl)
  url.searchParams.set('preview-theme', scheme)
  url.searchParams.set('lang', language)
  url.searchParams.set('v', String(version))

  return (
    <div className='space-y-2'>
      <PhoneFrame scheme={scheme} className={className}>
        <iframe
          key={`${version}-${scheme}-${language}-${reloads}`}
          src={url.href}
          title={t('previewLive')}
          sandbox='allow-scripts allow-same-origin allow-forms'
          referrerPolicy='no-referrer'
          className='h-full w-full border-0'
        />
      </PhoneFrame>
      <div className='flex justify-center gap-1'>
        <Button variant='ghost' size='sm' onClick={() => setReloads((n) => n + 1)}>
          <RotateCw className='me-1 size-3.5' />
          {t('reload')}
        </Button>
        <Button asChild variant='ghost' size='sm'>
          <a href={url.href} target='_blank' rel='noreferrer'>
            <ExternalLink className='me-1 size-3.5' />
            {t('openInNewTab')}
          </a>
        </Button>
      </div>
    </div>
  )
}
