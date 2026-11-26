import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

// Soft tints a face is told apart by; the same name always gets the same one
const TINTS = [
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
]

/** The first letters of a name's first two words; Arabic letters kept apart so they do not join */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0]?.toUpperCase() ?? '')
    .join('‌')
}

/**
 * A person as a round badge with their initials, tinted by their name: who a
 * line or a round is for, told at a glance without reading. Nobody (no name)
 * is a plain person mark.
 */
export function InitialsBadge({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const initials = initialsOf(name)
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        size === 'sm' ? 'size-6 text-[0.625rem]' : 'size-8 text-xs',
        initials ? TINTS[hash % TINTS.length] : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {initials || <User className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
    </span>
  )
}
