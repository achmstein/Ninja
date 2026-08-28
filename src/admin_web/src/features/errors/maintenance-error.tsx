import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function MaintenanceError() {
  const t = useT()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'>{t('maintenanceTitle')}</span>
        <p className='text-muted-foreground max-w-sm text-center'>
          {t('maintenanceMessage')}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline'>{t('learnMore')}</Button>
        </div>
      </div>
    </div>
  )
}
