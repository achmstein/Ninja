import { useNavigate, type LinkProps } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/**
 * Pushed-page header: back button + page title (mobile-app parity).
 * `to` is where back leads — the profile tab for its sub-pages.
 */
export function BackHeader({
  title,
  to = '/profile',
}: {
  title: string
  to?: LinkProps['to']
}) {
  const t = useT()
  const navigate = useNavigate()
  return (
    <div className='flex items-center gap-2 pt-2'>
      <Button
        variant='ghost'
        size='icon'
        className='-ms-2'
        aria-label={t('profile')}
        onClick={() => navigate({ to })}
      >
        <ArrowLeft className='h-5 w-5 rtl:rotate-180' />
      </Button>
      <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
    </div>
  )
}
