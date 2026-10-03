import { cn } from '@/lib/utils'

/** The first letter of the first two words: "Ahmed Kamal" → "AK", "كافيه السلام" → "كا" reads as "كس" */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = Array.from(words[0])[0] ?? ''
  const second = words.length > 1 ? (Array.from(words[1])[0] ?? '') : ''
  return (first + second).toUpperCase()
}

/**
 * A person or a business named by its initials: staff, suppliers,
 * partners, a payslip's employee. Quiet slate, never a colour of its own;
 * the name beside it is what is read.
 */
export function EntityAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
