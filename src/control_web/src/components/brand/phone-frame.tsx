import { cn } from '@/lib/utils'

/**
 * A phone's bezel around whatever the customer app looks like: the mock
 * drawn from the draft, or the real app in a frame. 360×740 inside, the
 * size the customer app is designed at; it scales down with its column.
 */
export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border-[10px] border-zinc-900 bg-zinc-900 shadow-xl dark:border-zinc-700',
        className
      )}
    >
      <div className='relative aspect-[360/740] w-full overflow-hidden rounded-[1.9rem] bg-background'>
        {/* The notch */}
        <div className='pointer-events-none absolute top-0 left-1/2 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900 dark:bg-zinc-700' />
        {children}
      </div>
    </div>
  )
}
