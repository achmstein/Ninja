import { useNavigate, useRouter } from '@tanstack/react-router'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function NotFoundError() {
  const t = useT()
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>404</h1>
        <span className='font-medium'>{t('notFoundTitle')}</span>
        <p className='text-muted-foreground max-w-sm text-center'>
          {t('notFoundMessage')}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            {t('goBack')}
          </Button>
          <Button onClick={() => navigate({ to: '/' })}>
            {t('backToHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
