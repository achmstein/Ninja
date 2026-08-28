import { Telescope } from 'lucide-react'
import { useT } from '@/lib/i18n'

export function ComingSoon() {
  const t = useT()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <Telescope size={72} />
        <h1 className='text-4xl leading-tight font-bold'>{t('comingSoon')}</h1>
        <p className='text-muted-foreground max-w-sm text-center'>
          {t('comingSoonMessage')}
        </p>
      </div>
    </div>
  )
}
