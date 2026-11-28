// A mock-up of ordering without guests, built from the customer web's own
// sheet, button and field, and its own stylesheet: what shows is the app's
// look, with nothing behind it. Not part of the app; built to one HTML file
// by .mock/build.mjs.
import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Bike, Check, ChevronLeft, MapPin, Minus, Phone, Plus, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { pillAction } from '@/components/ui/ninja-sheet'
import { applyBrandTheme } from '@/lib/brand-theme'
import { cn } from '@/lib/utils'
import './mock.css'

document.documentElement.dir = 'rtl'
document.documentElement.lang = 'ar'

const params = new URLSearchParams(location.hash.slice(1))
const way = params.get('way') === 'table' ? 'table' : 'delivery'
const returning = params.get('who') === 'back'

type Step = 'order' | 'address' | 'phone' | 'code' | 'name' | 'sent'

// Cove's own brand, as its stack answers /api/tenant today: its colour and theme paint the page the way the app paints it
applyBrandTheme({
  primaryColor: '#50000d',
  theme: { accent: null, surface: null, radius: null, fontLatin: null, fontArabic: null, dark: null, headerSize: 'sm', mode: 'light', style: 'ninja', slab: null },
} as never)
const WORDMARK = 'https://cove.ninjapp.net/api/tenant/images/wordmark-en?v=639265985370458857'
const pic = (id: number, v: string) => `https://api.cove.ninjapp.net/api/catalog/items/${id}/pic?v=${id}_${v}.webp`

// Three of Cove's own items, with their own photos and prices
const lines = [
  { name: 'سبانيش لاتيه', note: 'وسط', qty: 1, price: 100, photo: pic(7, '639265794954854194') },
  { name: 'لوتس لاتيه فرابيه', note: '', qty: 1, price: 120, photo: pic(24, '639265795532672123') },
  { name: 'كابوتشينو', note: '', qty: 2, price: 90, photo: pic(3, '639265794848925752') },
]
const fee = way === 'delivery' ? 30 : 0
const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0) + fee
const egp = (n: number) => `${n} ج.م`

function App() {
  const [step, setStep] = useState<Step>('order')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState(returning ? 'أحمد' : '')
  const [street, setStreet] = useState('شارع 9، المعادي')
  const [details, setDetails] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(false)

  const phoneOk = phone.replace(/\D/g, '').length >= 10
  // The address already gave the name and the number: nothing is asked twice
  const afterCode = () => setStep(!returning && !name.trim() ? 'name' : 'sent')

  // The code arrives in a message a moment after it is asked for
  useEffect(() => {
    if (step !== 'code') return
    setCode('')
    setMessage(false)
    const id = setTimeout(() => setMessage(true), 900)
    return () => clearTimeout(id)
  }, [step])

  const fill = () => {
    setMessage(false)
    '4821'.split('').forEach((_, i) => setTimeout(() => setCode('4821'.slice(0, i + 1)), 90 * (i + 1)))
    setTimeout(afterCode, 1000)
  }

  if (step === 'sent') {
    return (
      <main className='flex min-h-svh flex-col items-center justify-center gap-3 p-8 text-center'>
        <span className='bg-primary text-primary-foreground grid size-20 place-items-center rounded-full'>
          <Check className='size-9' strokeWidth={3} />
        </span>
        <h1 className='heading text-title font-bold'>طلبك اتبعت</h1>
        <p className='text-muted-foreground text-body'>
          {returning ? 'أهلاً بيك تاني يا أحمد.' : `أهلاً يا ${name.trim()}، حسابك اتعمل.`}
          <br />
          المرة الجاية هتطلب من غير أي سؤال.
        </p>
        <Button variant='outline' className='rounded-pill mt-4' onClick={() => location.reload()}>
          جرّب تاني
        </Button>
      </main>
    )
  }

  return (
    <main className='flex min-h-svh flex-col'>
      <header className='flex items-center gap-2 px-4 pt-5 pb-3'>
        <span className='bg-muted grid size-9 place-items-center rounded-full'>
          <ChevronLeft className='size-4 rotate-180' />
        </span>
        <h1 className='heading text-headline flex-1 font-bold'>طلبك</h1>
        <img src={WORDMARK} alt='Cove' className='h-6 w-auto' />
      </header>

      <div className='bg-muted mx-4 flex items-center gap-3 rounded-2xl p-3'>
        {way === 'delivery' ? <Bike className='size-5 shrink-0' /> : <Utensils className='size-5 shrink-0' />}
        <span className='flex min-w-0 flex-1 flex-col'>
          <span className='text-note font-semibold'>{way === 'delivery' ? 'توصيل' : 'طاولة 4'}</span>
          <span className='text-muted-foreground text-caption truncate'>
            {way === 'delivery' ? (step === 'order' ? 'اختار العنوان' : street) : 'هنجيبه لحد عندك'}
          </span>
        </span>
      </div>

      <ul className='divide-border flex-1 divide-y px-4 pt-2'>
        {lines.map((line) => (
          <li key={line.name} className='flex items-center gap-3 py-3'>
            <img src={line.photo} alt='' className='bg-muted size-14 shrink-0 rounded-2xl object-cover' />
            <span className='flex min-w-0 flex-1 flex-col'>
              <span className='text-name font-semibold'>{line.name}</span>
              {line.note && <span className='text-muted-foreground text-caption'>{line.note}</span>}
              <span className='text-note tabular-nums'>{egp(line.price)}</span>
            </span>
            <span className='bg-muted flex items-center gap-3 rounded-full p-1'>
              <span className='bg-background grid size-8 place-items-center rounded-full'>
                <Minus className='size-3.5' />
              </span>
              <span className='text-note font-semibold tabular-nums'>{line.qty}</span>
              <span className='bg-background grid size-8 place-items-center rounded-full'>
                <Plus className='size-3.5' />
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className='flex flex-col gap-2 px-4 pt-3 pb-6'>
        {fee > 0 && (
          <div className='text-muted-foreground text-note flex justify-between'>
            <span>التوصيل</span>
            <span className='tabular-nums'>{egp(fee)}</span>
          </div>
        )}
        <button type='button' className={cn(pillAction, 'h-14 justify-between px-6')} onClick={() => setStep(way === 'delivery' ? 'address' : 'phone')}>
          <span>أرسل الطلب</span>
          <span className='tabular-nums'>{egp(total)}</span>
        </button>
      </div>

      {/* Delivery: the address, with the name and number it already asks for. They are the account */}
      <Dialog open={step === 'address'} onOpenChange={(open) => !open && setStep('order')}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>التوصيل فين؟</DialogTitle>
          </DialogHeader>
          <form
            className='flex flex-col gap-3'
            onSubmit={(e) => {
              e.preventDefault()
              if (phoneOk && (returning || name.trim())) setStep('code')
            }}
          >
            <div className='mock-map relative block h-32 overflow-hidden rounded-[1.25rem]'>
              <span className='bg-background text-foreground text-caption absolute end-2 bottom-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold shadow-md'>
                <MapPin className='size-3.5' />
                عدّل المكان
              </span>
            </div>
            <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder='الشارع' />

            {/* What helps the rider, each added only if wanted: nothing to skip past */}
            <div className='flex flex-wrap gap-2'>
              {['عمارة', 'دور', 'شقة', 'علامة مميزة'].map((key) =>
                editing === key ? (
                  <label key={key} className='border-primary text-note flex h-11 items-center gap-2 rounded-full border-2 ps-4 pe-2'>
                    {key}
                    <input
                      autoFocus
                      value={details[key] ?? ''}
                      onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), setEditing(null))}
                      className={cn('bg-transparent font-semibold outline-none', key === 'علامة مميزة' ? 'w-40' : 'w-16')}
                    />
                  </label>
                ) : details[key] ? (
                  <button key={key} type='button' onClick={() => setEditing(key)} className='bg-primary text-primary-foreground text-note h-11 rounded-full px-4 font-semibold'>
                    {key} {details[key]}
                  </button>
                ) : (
                  <button key={key} type='button' onClick={() => setEditing(key)} className='border-border text-muted-foreground text-note h-11 rounded-full border border-dashed px-4'>
                    + {key}
                  </button>
                ),
              )}
            </div>

            {!returning && <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='اسمك' autoComplete='name' />}
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='رقم الموبايل'
              type='tel'
              inputMode='tel'
              autoComplete='tel'
              dir='ltr'
              className='rtl:text-right'
            />
            <button type='submit' className={cn(pillAction, 'h-14')} disabled={!phoneOk || (!returning && !name.trim())}>
              تأكيد العنوان
            </button>
            <p className='text-muted-foreground text-caption text-center'>هنبعت كود على الرقم ده عشان نتأكد إنه رقمك.</p>
          </form>
        </DialogContent>
      </Dialog>

      {/* At a table: one field, the number */}
      <Dialog open={step === 'phone'} onOpenChange={(open) => !open && setStep('order')}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>رقم موبايلك؟</DialogTitle>
            <DialogDescription>عشان نبعت طلبك ونعرّفك لما يجهز. من غير باسورد ولا إيميل.</DialogDescription>
          </DialogHeader>
          <form
            className='flex flex-col gap-3'
            onSubmit={(e) => {
              e.preventDefault()
              if (phoneOk) setStep('code')
            }}
          >
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='010 1234 5678'
              type='tel'
              inputMode='tel'
              autoComplete='tel'
              dir='ltr'
              className='rtl:text-right'
            />
            <button type='submit' className={cn(pillAction, 'h-14')} disabled={!phoneOk}>
              ابعت الكود
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* The code: it fills itself from the message */}
      <Dialog open={step === 'code'} onOpenChange={(open) => !open && setStep('order')}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>اكتب الكود</DialogTitle>
            <DialogDescription>
              بعتناه على{' '}
              <bdi dir='ltr' className='text-foreground font-semibold'>
                {phone}
              </bdi>
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-4'>
            <div className='grid grid-cols-4 gap-3' dir='ltr'>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'text-title grid h-16 place-items-center rounded-2xl border-2 font-bold tabular-nums',
                    code.length === 4 ? 'border-primary bg-primary/10' : i === code.length ? 'border-primary' : 'border-border',
                  )}
                >
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
            <p className='text-muted-foreground text-caption text-center'>
              موصلش؟ <span className='text-foreground font-semibold underline underline-offset-4'>ابعته تاني</span> بعد 0:30
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* A new customer at a table: the one thing still missing */}
      <Dialog open={step === 'name'} onOpenChange={(open) => !open && setStep('order')}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>اسمك إيه؟</DialogTitle>
            <DialogDescription>عشان نناديك لما طلبك يجهز.</DialogDescription>
          </DialogHeader>
          <form
            className='flex flex-col gap-3'
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) setStep('sent')
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='الاسم' autoComplete='given-name' />
            <button type='submit' className={cn(pillAction, 'h-14')} disabled={!name.trim()}>
              أرسل الطلب
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* The phone's own message banner: a tap fills the code, as SMS autofill does */}
      <button type='button' onClick={fill} className={cn('mock-sms', message && step === 'code' && 'in')}>
        <span className='grid size-10 shrink-0 place-items-center rounded-xl bg-green-500 text-white'>
          <Phone className='size-5' />
        </span>
        <span className='flex flex-col text-start'>
          <span className='text-caption text-neutral-500'>رسالة جديدة · دلوقتي</span>
          <span className='text-note font-semibold text-neutral-900'>كود التأكيد بتاعك 4821</span>
        </span>
      </button>
    </main>
  )
}

function Root() {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
