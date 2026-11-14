import { useRef, useState, type FormEvent } from 'react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'
import { origin } from '@/lib/origin'
import { FORM_KIND } from '@/lib/pages'
import { lighten, MAX_PHOTOS, PHOTO_ACCEPT } from '@/lib/photo'

/** The kinds of place the form offers, by the control plane's names for them */
const KINDS = ['CoffeeShop', 'Restaurant', 'GameStation', 'Other'] as const
type Kind = (typeof KINDS)[number]

const field = 'h-14 w-full rounded-2xl bg-white px-5 text-[1.0625rem] text-ink shadow-[0_0_0_1px_rgb(0_0_0/.08)] outline-none placeholder:text-soft/70 focus-visible:shadow-[0_0_0_2px_var(--color-ink)]'

/**
 * Asking for a demo without a chat: the place, a name, a WhatsApp number, the
 * kind of place and, if they have it to hand, photos of the menu. It goes to
 * Ninja's people with where the visit came from; they set the demo up and
 * write back. Nothing is made by the form itself.
 */
export function AskForm({ className }: { className?: string }) {
  const { c, lang, page } = useLang()
  const f = c.form
  const picker = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<Kind>(FORM_KIND[page])
  const [photos, setPhotos] = useState<File[]>([])
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')

  const send = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    const body = new FormData(e.currentTarget)
    body.set('businessType', kind)
    body.set('language', lang)
    for (const [key, value] of Object.entries(origin())) if (value) body.set(key, value)
    try {
      for (const photo of photos) body.append('photos', await lighten(photo))
      const answer = await fetch('/api/control/leads', { method: 'POST', body })
      setState(answer.ok ? 'done' : 'failed')
    } catch {
      setState('failed')
    }
  }

  if (state === 'done')
    return (
      <p role='status' className={cn('mx-auto max-w-[24ch] text-[clamp(1.25rem,2.4vw,1.75rem)] leading-snug', className)}>
        {f.done}
      </p>
    )

  return (
    <form onSubmit={send} className={cn('mx-auto grid w-full max-w-[440px] gap-3 text-start', className)}>
      <input name='business' required maxLength={80} autoComplete='organization' placeholder={f.business} aria-label={f.business} className={field} />
      <input name='name' required maxLength={80} autoComplete='name' placeholder={f.name} aria-label={f.name} className={field} />
      <input name='phone' required type='tel' inputMode='tel' dir='ltr' minLength={7} maxLength={24} autoComplete='tel' placeholder={f.phone} aria-label={f.phone} className={cn(field, 'placeholder:text-start')} />
      {/* People never see this one; a robot fills it and is dropped */}
      <input name='website' tabIndex={-1} autoComplete='off' aria-hidden className='hidden' />

      <div role='radiogroup' aria-label={f.kind} className='flex flex-wrap gap-2 pt-1'>
        {KINDS.map((k) => (
          <button
            key={k}
            type='button'
            role='radio'
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn('min-h-11 rounded-full px-4 text-[0.9375rem] transition-colors', kind === k ? 'bg-ink text-white' : 'bg-white text-ink shadow-[0_0_0_1px_rgb(0_0_0/.08)] hover:shadow-[0_0_0_1px_rgb(0_0_0/.3)]')}
          >
            {f.kinds[k]}
          </button>
        ))}
      </div>

      <input
        ref={picker}
        type='file'
        accept={PHOTO_ACCEPT}
        multiple
        className='hidden'
        onChange={(e) => {
          setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))
          e.target.value = ''
        }}
      />
      <button type='button' onClick={() => picker.current?.click()} className='min-h-11 justify-self-start text-[1.0625rem] text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink'>
        {photos.length > 0 ? f.photosCount.replace('{n}', String(photos.length)) : f.photos}
      </button>

      <button type='submit' disabled={state === 'sending'} className='mt-2 inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-6 text-[1.0625rem] font-medium text-white transition-colors hover:bg-black disabled:opacity-60'>
        {state === 'sending' ? f.sending : f.send}
      </button>
      {state === 'failed' && (
        <p role='alert' className='text-center text-[0.9375rem] text-[#b3261e]'>
          {f.failed}
        </p>
      )}
    </form>
  )
}
