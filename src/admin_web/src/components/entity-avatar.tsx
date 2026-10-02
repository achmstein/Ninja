import { cn } from '@/lib/utils'

/** Soft colours a name settles on, the same name always the same one */
const TINTS = [
  'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/20 text-amber-800 dark:text-amber-300',
  'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
]

/** The first letter of the first two words: "Ahmed Kamal" → "AK", "كافيه السلام" → "كا" reads as "كس" */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = Array.from(words[0])[0] ?? ''
  const second = words.length > 1 ? (Array.from(words[1])[0] ?? '') : ''
  return (first + second).toUpperCase()
}

function tintOf(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) | 0
  return TINTS[Math.abs(hash) % TINTS.length]
}

/**
 * A person or a business named by its initials on a colour of its own:
 * staff, suppliers, partners, a payslip's employee. The same name is always
 * the same colour, so a list is easier to scan.
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
        'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
        tintOf(name),
        className
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
