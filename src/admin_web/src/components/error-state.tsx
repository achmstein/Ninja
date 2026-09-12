import { AxiosError } from 'axios'
import { useNavigate } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

type ErrorStateProps = {
  /** HTTP-ish code for the full-page variants (401, 404, 500 …) */
  code?: string | number
  title?: React.ReactNode
  description?: React.ReactNode
  /** The failed query's error; a server problem `detail` becomes the description */
  error?: unknown
  onRetry?: () => void
  /** Offer "Back to home" (full-page errors) */
  home?: boolean
  /** Extra buttons */
  actions?: React.ReactNode
  /** `screen` is a whole viewport, `page` fills the content area, `section` sits inside a page */
  size?: 'page' | 'section' | 'screen'
  className?: string
}

function problemDetail(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { detail?: string; title?: string }
      | undefined
    return data?.detail || data?.title || undefined
  }
  return undefined
}

/**
 * The one failure surface: a failed query inside a page, a denied gate, or
 * a whole error route. Failure never renders as an empty list.
 */
export function ErrorState({
  code,
  title,
  description,
  error,
  onRetry,
  home,
  actions,
  size = 'section',
  className,
}: ErrorStateProps) {
  const t = useT()
  const navigate = useNavigate()
  const detail =
    description ?? problemDetail(error) ?? t('errorStateDescription')

  return (
    <Empty
      role='alert'
      className={cn(
        size === 'screen'
          ? 'h-svh'
          : size === 'page'
            ? 'min-h-[60svh]'
            : 'py-16',
        className
      )}
    >
      <EmptyHeader>
        {code ? (
          <div className='text-muted-foreground text-5xl font-bold tracking-tight tabular-nums'>
            {code}
          </div>
        ) : (
          <EmptyMedia variant='icon'>
            <TriangleAlert className='text-destructive' />
          </EmptyMedia>
        )}
        <EmptyTitle>{title ?? t('errorStateTitle')}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
      {(onRetry || home || actions) && (
        <EmptyContent>
          <div className='flex flex-wrap justify-center gap-2'>
            {onRetry && (
              <Button variant='outline' onClick={onRetry}>
                {t('retry')}
              </Button>
            )}
            {actions}
            {home && (
              <Button onClick={() => navigate({ to: '/' })}>
                {t('backToHome')}
              </Button>
            )}
          </div>
        </EmptyContent>
      )}
    </Empty>
  )
}
