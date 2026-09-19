import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { StepDto } from '@/api/control'
import { useT } from '@/lib/i18n'
import { duration } from '@/lib/format'
import { stepLabelKey, stepStatus, type StepStatusName } from '@/lib/tenant'
import { cn } from '@/lib/utils'

const dotClass: Record<StepStatusName, string> = {
  Pending: 'bg-muted-foreground/40',
  Running: 'bg-amber-500 animate-pulse',
  Done: 'bg-emerald-500',
  Failed: 'bg-destructive',
  Skipped: 'bg-muted-foreground/40',
}

/**
 * The latest run, one line per step: a status dot, the name, how long it
 * took, and its output behind a click. A running step's clock ticks.
 */
export function Steps({ steps }: { steps: StepDto[] }) {
  const t = useT()
  const anyRunning = steps.some((s) => stepStatus(s.status) === 'Running')
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!anyRunning) return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [anyRunning])

  if (steps.length === 0) {
    return <p className='text-muted-foreground text-sm'>{t('noSteps')}</p>
  }

  return (
    <ol className='divide-y rounded-lg border'>
      {steps.map((step, i) => (
        <StepRow key={`${step.name}-${i}`} step={step} nowMs={nowMs} />
      ))}
    </ol>
  )
}

function StepRow({ step, nowMs }: { step: StepDto; nowMs: number }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const status = stepStatus(step.status)
  const hasOutput = Boolean(step.output?.trim())

  return (
    <li>
      <button
        type='button'
        onClick={() => hasOutput && setOpen((v) => !v)}
        aria-expanded={hasOutput ? open : undefined}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm',
          hasOutput ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'
        )}
      >
        <span
          aria-hidden
          className={cn('size-2.5 shrink-0 rounded-full', dotClass[status])}
        />
        <span className='flex-1 truncate font-medium'>{step.name}</span>
        <span className='text-muted-foreground text-xs'>
          {t(stepLabelKey[status])}
        </span>
        <span className='text-muted-foreground w-16 text-end text-xs tabular-nums'>
          {status === 'Pending' ? '' : duration(step.startedAt, step.finishedAt, nowMs)}
        </span>
        <ChevronRight
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform rtl:rotate-180',
            open && 'rotate-90 rtl:rotate-90',
            !hasOutput && 'invisible'
          )}
        />
      </button>
      {open && hasOutput && (
        <pre className='bg-muted/50 max-h-96 overflow-auto border-t px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap' dir='ltr'>
          {step.output}
        </pre>
      )}
    </li>
  )
}
