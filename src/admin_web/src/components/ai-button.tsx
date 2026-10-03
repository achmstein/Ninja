import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * The one look of "let the AI do it": an outline button in the main colour
 * with the sparkle, its label a verb and "with AI". While it works, the
 * sparkle turns into a spinner and the label stays. `why` says what it is
 * waiting for when it cannot run yet ("Type the name first").
 */
export function AiButton({
  children,
  onClick,
  pending = false,
  disabled = false,
  why,
  variant = 'outline',
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  pending?: boolean
  disabled?: boolean
  why?: string
  /** The main action of its place (a review sheet's footer) */
  variant?: 'outline' | 'default'
  className?: string
}) {
  return (
    <Button
      type='button'
      size='sm'
      variant={variant}
      className={cn(
        variant === 'outline' && 'text-primary hover:text-primary',
        className
      )}
      disabled={disabled || pending}
      title={disabled ? why : undefined}
      onClick={onClick}
    >
      {pending ? <Spinner /> : <Sparkles />}
      {children}
    </Button>
  )
}
