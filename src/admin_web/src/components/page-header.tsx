import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type PageHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  /** Child page of a sidebar entry (history, print): a back arrow before the title */
  back?: { to: LinkProps['to']; search?: LinkProps['search'] }
  /** Count or status next to the title */
  badge?: React.ReactNode
  /** Page-level actions, end-aligned */
  actions?: React.ReactNode
  /** A row under the title: tabs, a range picker */
  children?: React.ReactNode
  className?: string
}

/**
 * The one page title block. Title and description on the start side, the
 * page's actions on the end side, an optional row (tabs, filters) below.
 */
export function PageHeader({
  title,
  description,
  back,
  badge,
  actions,
  children,
  className,
}: PageHeaderProps) {
  const t = useT()
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-2'>
        <div className='flex min-w-0 items-start gap-2'>
          {back && (
            <Button
              asChild
              variant='ghost'
              size='icon'
              className='-ms-2 size-9 shrink-0'
            >
              <Link to={back.to} search={back.search} aria-label={t('goBack')}>
                <ArrowLeft className='rtl:rotate-180' />
              </Link>
            </Button>
          )}
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
              {badge}
            </div>
            {description && (
              <p className='text-muted-foreground text-sm'>{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className='flex flex-wrap items-center gap-2'>{actions}</div>
        )}
      </div>
      {children}
    </div>
  )
}
