import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUp, Wrench } from 'lucide-react'
import { ASKED_FOR, itemById } from '@/cafe/menu'
import { useCafe, waiting } from '@/cafe/store'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'
import { spring } from '@/lib/motion'

type AskId = 'today' | 'low' | 'margins' | 'add'
type Turn = { id: number; ask: AskId; answer: string; tool: string; shown: number }

/**
 * The owner asking their café, as it reads in an assistant connected to
 * Ninja. The questions are set; the answers are worked out from the page's
 * own café as it stands, and "add a dish" does add it: it is on the guest's
 * menu and the till from then on.
 */
export function AssistantChat({ className }: { className?: string }) {
  const { c, lang } = useLang()
  const reduced = useReducedMotion()
  const [turns, setTurns] = useState<Turn[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const typing = turns.some((t) => t.shown < t.answer.length)

  // The answer comes out a few characters at a time
  useEffect(() => {
    if (!typing) return
    const id = window.setInterval(() => setTurns((ts) => ts.map((t) => (t.shown < t.answer.length ? { ...t, shown: reduced ? t.answer.length : t.shown + 3 } : t))), 24)
    return () => window.clearInterval(id)
  }, [typing, reduced])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [turns])

  const ask = (id: AskId) => {
    const cafe = useCafe.getState()
    cafe.touch()
    const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''))
    const sold = new Map<string, number>()
    for (const o of cafe.orders) for (const l of o.lines) sold.set(l.id, (sold.get(l.id) ?? 0) + l.qty)
    const best = [...sold.entries()].sort((a, b) => b[1] - a[1])[0]
    const answers: Record<AskId, string> = {
      today: fill(c.assistant.answers.today, {
        sales: cafe.salesToday.toLocaleString('en'),
        orders: cafe.ordersToday,
        average: Math.round(cafe.salesToday / cafe.ordersToday),
        best: best ? itemById(best[0]).name[lang] : '',
        waiting: waiting(cafe.orders).length,
      }),
      low: c.assistant.answers.low,
      margins: c.assistant.answers.margins,
      add: cafe.added ? c.assistant.answers.addedAlready : fill(c.assistant.answers.add, { name: ASKED_FOR.name[lang], price: ASKED_FOR.price }),
    }
    if (id === 'add') cafe.addDish()
    setTurns((ts) => [...ts, { id: ts.length, ask: id, answer: answers[id], tool: c.assistant.tools[id], shown: 0 }])
  }

  return (
    <div className={cn('flex h-[520px] flex-col overflow-hidden rounded-[22px] bg-white text-slate-950 shadow-[0_0_0_1px_rgb(2_6_24/.08),0_40px_80px_-24px_rgb(2_6_24/.35)]', className)}>
      <div ref={scroller} className='no-bar min-h-0 flex-1 overflow-y-auto p-5 sm:p-6' aria-live='polite'>
        {turns.length === 0 && <p className='max-w-[42ch] text-[15px] leading-relaxed text-slate-500'>{c.assistant.empty}</p>}
        {turns.map((t) => (
          <div key={t.id} className='mb-5 last:mb-0'>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className='ms-auto w-fit max-w-[85%] rounded-[18px] rounded-ee-[6px] bg-slate-100 px-4 py-2.5 text-[15px]'>
              {c.assistant.asks[t.ask]}
            </motion.div>
            <div className='mt-3 flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-700'>
              <Wrench size={12} />
              <span>Ninja</span>
              <span dir='ltr' className='opacity-70'>
                {t.tool}
              </span>
            </div>
            <p className='mt-2 max-w-[60ch] text-[15px] leading-relaxed whitespace-pre-line'>{t.answer.slice(0, t.shown)}</p>
          </div>
        ))}
      </div>
      <div className='border-t border-slate-100 p-3 sm:p-4'>
        <div className='flex flex-wrap gap-2'>
          {(Object.keys(c.assistant.asks) as AskId[]).map((id) => (
            <button
              key={id}
              type='button'
              disabled={typing}
              onClick={() => ask(id)}
              className='flex items-center gap-2 rounded-full border border-slate-200 px-3.5 py-2 text-start text-[14px] font-medium transition-colors hover:bg-slate-50 disabled:opacity-50'
            >
              {c.assistant.asks[id]}
              <ArrowUp size={14} className='shrink-0 text-slate-400' />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
