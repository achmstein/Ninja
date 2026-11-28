// A mock-up of cancelling one item of an order the kitchen already has, built
// from the web till's own button, dialog and field, its own type roles and its
// own stylesheet: what shows is the till's look, with nothing behind it. Not
// part of the till; built to one HTML file by .mock/build.mjs.
import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ArrowRight, Check, Minus, PackageCheck, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import './mock.css'

document.documentElement.dir = 'rtl'
document.documentElement.lang = 'ar'

type Line = { id: number; name: string; details?: string; qty: number; price: number; who?: string }
type Cancelled = { qty: number; reason: string; made: boolean }

const LINES: Line[] = [
  { id: 1, name: 'برجر دبل', details: 'بدون بصل', qty: 2, price: 165, who: 'أحمد' },
  { id: 2, name: 'بطاطس', qty: 1, price: 50, who: 'أحمد' },
  { id: 3, name: 'شاورما دجاج', qty: 1, price: 100, who: 'منى' },
  { id: 4, name: 'عصير مانجو', details: 'وسط', qty: 2, price: 60, who: 'منى' },
]
const REASONS = ['العميل غيّر رأيه', 'اتسجل غلط', 'خلص من عندنا', 'اتأخر']
const egp = (n: number) => `${n} ج.م`

function App() {
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [cancelled, setCancelled] = useState<Record<number, Cancelled>>({})
  const [open, setOpen] = useState(false)
  // How many of each picked line go; a line of one goes whole
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [made, setMade] = useState(true)

  const left = (line: Line) => line.qty - (cancelled[line.id]?.qty ?? 0)
  const total = LINES.reduce((sum, line) => sum + left(line) * line.price, 0)
  const chosen = LINES.filter((line) => picked.has(line.id) && left(line) > 0)
  const count = (line: Line) => Math.min(counts[line.id] ?? left(line), left(line))
  const back = chosen.reduce((sum, line) => sum + count(line) * line.price, 0)
  const items = chosen.reduce((sum, line) => sum + count(line), 0)

  const toggle = (id: number) =>
    setPicked((now) => {
      const next = new Set(now)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const start = () => {
    setCounts({})
    setReason('')
    setMade(true)
    setOpen(true)
  }

  const confirm = () => {
    setCancelled((now) => {
      const next = { ...now }
      for (const line of chosen) next[line.id] = { qty: (now[line.id]?.qty ?? 0) + count(line), reason: reason.trim(), made }
      return next
    })
    setPicked(new Set())
    setOpen(false)
  }

  const itemsWord = (n: number) => (n === 1 ? 'صنف واحد' : n === 2 ? 'صنفين' : `${n} أصناف`)

  return (
    <div className='flex h-svh'>
      {/* The bill, as the order's panel on the sale screen */}
      <section className='flex min-w-0 flex-1 flex-col border-e'>
        <div className='flex min-h-16 shrink-0 items-center gap-2 border-b px-3 py-2'>
          <Button variant='ghost' size='icon' className='size-12 shrink-0' aria-label='الصالة'>
            <ArrowRight className='size-6' />
          </Button>
          <div className='min-w-0 flex-1'>
            <h1 className='type-title'>طاولة 4</h1>
            <p className='text-muted-foreground type-detail tabular-nums'>فاتورة #93 · اتبعت للمطبخ من 6 دقايق</p>
          </div>
        </div>

        <ul className='min-h-0 flex-1 overflow-y-auto'>
          {LINES.map((line) => {
            const gone = cancelled[line.id]
            const all = left(line) === 0
            const on = picked.has(line.id)
            return (
              <li key={line.id} className={cn('border-b', on && 'bg-accent')}>
                <button
                  type='button'
                  role='checkbox'
                  aria-checked={on}
                  disabled={all}
                  onClick={() => toggle(line.id)}
                  className='hover:bg-accent/60 flex min-h-16 w-full items-center gap-3 px-4 py-2 text-start disabled:hover:bg-transparent'
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md border',
                      all ? 'border-transparent' : on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50',
                    )}
                  >
                    {on && <Check className='size-4' />}
                  </span>
                  <span className={cn('text-muted-foreground w-9 shrink-0 tabular-nums', all && 'opacity-50')}>{left(line) || line.qty}×</span>
                  <span className='min-w-0 flex-1'>
                    <span className={cn('type-body block font-medium', all && 'text-muted-foreground line-through')}>{line.name}</span>
                    <span className='text-muted-foreground type-detail block'>
                      {[line.details, line.who].filter(Boolean).join(' · ')}
                    </span>
                    {gone && (
                      <span className='text-destructive type-detail block font-medium'>
                        اتلغى {gone.qty < line.qty ? `${gone.qty} من ${line.qty}` : ''} · {gone.reason} · {gone.made ? 'هالك' : 'رجع المخزون'}
                      </span>
                    )}
                  </span>
                  <span className={cn('type-body shrink-0 font-medium tabular-nums', all && 'text-muted-foreground line-through')}>
                    {egp((left(line) || line.qty) * line.price)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* The foot: what is done with the picked lines, or the bill's own main action */}
        <div className='flex shrink-0 items-center gap-2 border-t px-4 py-3'>
          {chosen.length > 0 ? (
            <>
              <Button variant='outline' size='lg' className='h-14 min-w-32 text-base' onClick={() => setPicked(new Set())}>
                رجوع
              </Button>
              <Button variant='outline' size='lg' className='h-14 min-w-36 text-base'>
                نقل…
              </Button>
              <Button
                variant='outline'
                size='lg'
                className='text-destructive hover:text-destructive ms-auto h-14 min-w-56 gap-2 text-base font-semibold'
                onClick={start}
              >
                <X className='size-5' />
                إلغاء {itemsWord(chosen.length)}
              </Button>
            </>
          ) : (
            <Button size='lg' className='ms-auto h-14 min-w-72 justify-between gap-4 px-6 text-lg font-semibold'>
              <span>ادفع</span>
              <span className='tabular-nums'>{egp(total)}</span>
            </Button>
          )}
        </div>
      </section>

      {/* What the kitchen sees: the same ticket, the cancelled line struck and said in red */}
      <aside className='bg-muted/60 flex w-[22rem] shrink-0 flex-col gap-3 p-4'>
        <div className='text-muted-foreground type-label'>شاشة المطبخ دلوقتي</div>
        <article className='bg-card flex flex-col overflow-hidden rounded-xl border'>
          <div className='h-[3px] shrink-0 bg-amber-500' />
          <header className='flex items-start gap-3 px-3.5 pt-2.5 pb-2'>
            <div className='min-w-0 flex-1'>
              <div className='type-heading'>طاولة 4</div>
              <div className='text-muted-foreground type-caption tabular-nums'>#93 · أحمد</div>
            </div>
            <span className='type-heading shrink-0 text-amber-600 tabular-nums'>6m</span>
          </header>
          <ul className='divide-y border-t px-3.5'>
            {LINES.map((line) => {
              const gone = cancelled[line.id]
              const all = left(line) === 0
              return (
                <li key={line.id} className='flex gap-2.5 py-2'>
                  <span className={cn('type-body w-7 shrink-0 font-semibold tabular-nums', all && 'text-muted-foreground font-normal line-through')}>
                    {left(line) || line.qty}×
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className={cn('type-body font-medium', all && 'text-muted-foreground font-normal line-through')}>{line.name}</div>
                    {line.details && <div className='text-muted-foreground type-detail'>{line.details}</div>}
                    {gone && (
                      <div className='text-destructive type-detail font-semibold'>
                        {all ? 'اتلغى، متعملوش' : `اتلغى ${gone.qty}: اعمل ${left(line)} بس`}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <footer className='px-3 pt-0.5 pb-3'>
            <Button className='h-11 w-full'>جاهز</Button>
          </footer>
        </article>
        <p className='text-muted-foreground type-caption'>
          التذكرة بتفضل مكانها. الصنف الملغي بيتشطب وبيتقال بالأحمر، ولو المطبخ بيطبع ورق بتطلع ورقة إلغاء.
        </p>
      </aside>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size='lg' className='gap-4'>
          <DialogHeader>
            <DialogTitle className='type-title'>إلغاء {itemsWord(items)}</DialogTitle>
            <DialogDescription className='type-body'>من طاولة 4. المطبخ هيشوف الإلغاء فورًا.</DialogDescription>
          </DialogHeader>

          {/* What goes: a line of more than one says how many of it */}
          <ul className='divide-y rounded-lg border'>
            {chosen.map((line) => (
              <li key={line.id} className='flex min-h-14 items-center gap-3 px-3 py-2'>
                <span className='min-w-0 flex-1'>
                  <span className='type-body block font-medium'>{line.name}</span>
                  {line.details && <span className='text-muted-foreground type-detail block'>{line.details}</span>}
                </span>
                {left(line) > 1 ? (
                  <span className='flex shrink-0 items-center gap-1'>
                    <Button
                      variant='outline'
                      size='icon'
                      className='size-11 rounded-full'
                      disabled={count(line) <= 1}
                      aria-label='أقل'
                      onClick={() => setCounts((now) => ({ ...now, [line.id]: count(line) - 1 }))}
                    >
                      <Minus className='size-4' />
                    </Button>
                    <span className='type-body w-14 text-center font-semibold tabular-nums'>
                      {count(line)} من {left(line)}
                    </span>
                    <Button
                      variant='outline'
                      size='icon'
                      className='size-11 rounded-full'
                      disabled={count(line) >= left(line)}
                      aria-label='أكتر'
                      onClick={() => setCounts((now) => ({ ...now, [line.id]: count(line) + 1 }))}
                    >
                      <Plus className='size-4' />
                    </Button>
                  </span>
                ) : (
                  <span className='text-muted-foreground type-body shrink-0 tabular-nums'>1×</span>
                )}
                <span className='type-body w-20 shrink-0 text-end font-medium tabular-nums'>{egp(count(line) * line.price)}</span>
              </li>
            ))}
          </ul>

          {/* Why: mandatory, it is the audit trail. The usual ones are a tap; any other is typed */}
          <div>
            <div className='text-muted-foreground type-label pb-1'>السبب</div>
            <div className='flex flex-wrap gap-2'>
              {REASONS.map((why) => (
                <Button key={why} variant={reason === why ? 'default' : 'outline'} className='h-11' onClick={() => setReason(why)}>
                  {why}
                </Button>
              ))}
            </div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder='سبب تاني' className='mt-2 h-12 text-base' autoComplete='off' />
          </div>

          {/* What becomes of the food, as voiding a bill asks */}
          <fieldset className='flex flex-col gap-2'>
            <legend className='type-detail mb-2 font-medium'>الأكل اتعمل؟</legend>
            <div className='grid grid-cols-2 gap-2'>
              {[
                { value: true, label: 'اتعمل: هالك', hint: 'المكوّنات اتصرفت خلاص', Icon: Trash2 },
                { value: false, label: 'لسه: يرجع المخزون', hint: 'المكوّنات ترجع للرف', Icon: PackageCheck },
              ].map(({ value, label, hint, Icon }) => (
                <label
                  key={String(value)}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-start transition-colors',
                    made === value ? 'border-primary bg-primary/5' : 'hover:bg-muted',
                  )}
                >
                  <span className='type-body flex items-center gap-2 font-medium'>
                    <input type='radio' name='made' checked={made === value} onChange={() => setMade(value)} className='accent-primary size-4 shrink-0' />
                    <Icon className='size-4 shrink-0' aria-hidden />
                    {label}
                  </span>
                  <span className='text-muted-foreground type-caption'>{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <DialogFooter className='gap-2'>
            <Button variant='outline' size='lg' className='h-14 min-w-32 text-base' onClick={() => setOpen(false)}>
              رجوع
            </Button>
            <Button
              variant='destructive'
              size='lg'
              className='h-14 min-w-64 justify-between gap-4 px-6 text-lg font-semibold'
              disabled={!reason.trim()}
              onClick={confirm}
            >
              <span>إلغاء {itemsWord(items)}</span>
              <span className='tabular-nums'>−{egp(back)}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
