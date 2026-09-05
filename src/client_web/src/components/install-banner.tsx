import { useState } from 'react'
import { Download } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useInstallPrompt } from '@/lib/use-install-prompt'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { InstallDialog } from './install-dialog'

const DISMISSED_KEY = 'chillax-install-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Storage blocked: the banner simply comes back next visit
  }
}

/** Home-page nudge to install the PWA. Android gets the native prompt, iOS
 *  the share-sheet walkthrough. Never shown once installed, and "Not now"
 *  sticks on this browser. */
export function InstallBanner() {
  const t = useT()
  const { canInstall, install, isStandalone, isIos } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [howOpen, setHowOpen] = useState(false)

  if (isStandalone || dismissed || !(canInstall || isIos)) return null

  const onInstall = () => {
    if (canInstall) void install()
    else setHowOpen(true)
  }

  const dismiss = () => {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <>
      <Alert>
        <Download />
        <AlertTitle>{t('installAppTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t('installAppDescription')}</p>
          <div className='mt-1 flex gap-2'>
            <Button size='sm' onClick={onInstall}>
              {canInstall ? t('install') : t('howTo')}
            </Button>
            <Button size='sm' variant='ghost' onClick={dismiss}>
              {t('notNow')}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
      <InstallDialog open={howOpen} onOpenChange={setHowOpen} />
    </>
  )
}
