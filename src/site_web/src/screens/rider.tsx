import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, MapPin, Navigation, Phone as PhoneIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'
import { spring } from '@/lib/motion'
import { Odometer } from '@/lib/odometer'
import { Phone } from './frames'

const STEPS = ['assigned', 'picked', 'onWay', 'delivered'] as const
export type RiderStep = (typeof STEPS)[number]

const DELIVERY = { no: 57, total: 345, fee: 25 }

/**
 * The rider's app, as rider_app draws it: on duty, the delivery in hand with
 * its steps, and the cash carried today. The step is the page's, so the map
 * beside it can follow the rider.
 */
export function RiderPhone({ step, onStep, className }: { step: RiderStep; onStep: (step: RiderStep) => void; className?: string }) {
  const { c } = useLang()
  const [onDuty, setOnDuty] = useState(true)
  const at = STEPS.indexOf(step)
  const done = step === 'delivered'
  const cash = 1_180 + (done ? DELIVERY.total : 0)
  return (
    <Phone className={className} font='var(--font-staff)'>
      <div className='absolute inset-0 flex flex-col bg-slate-50 px-[16px] pt-[60px]'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-[26px] font-extrabold tracking-[-0.02em]'>{c.rider.today}</div>
            <div className='text-[14px] text-slate-500'>Karim</div>
          </div>
          <button
            type='button'
            role='switch'
            aria-checked={onDuty}
            onClick={() => setOnDuty((v) => !v)}
            className={cn('flex h-[40px] items-center gap-[8px] rounded-full px-[14px] text-[14px] font-semibold transition-colors', onDuty ? 'bg-[#0d9488] text-white' : 'bg-slate-200 text-slate-600')}
          >
            <span className={cn('size-[8px] rounded-full', onDuty ? 'bg-white' : 'bg-slate-400')} />
            {onDuty ? c.rider.onDuty : c.rider.offDuty}
          </button>
        </div>

        <div className='mt-[18px] rounded-[20px] bg-white p-[16px] shadow-[0_1px_2px_rgb(0_0_0/.05)] ring-1 ring-slate-200'>
          <div className='text-[13px] font-medium text-slate-500'>{c.rider.cashToday}</div>
          <Odometer value={`${c.ui.egp} ${cash.toLocaleString('en')}`} className='text-[28px] font-extrabold tracking-[-0.02em]' />
        </div>

        {onDuty ? (
          <div className='mt-[14px] rounded-[20px] bg-white p-[16px] shadow-[0_1px_2px_rgb(0_0_0/.05)] ring-1 ring-slate-200'>
            <div className='flex items-center justify-between'>
              <span className='text-[18px] font-extrabold'>#{DELIVERY.no}</span>
              <span className='rounded-full bg-amber-100 px-[10px] py-[4px] text-[13px] font-bold text-amber-800'>
                {c.rider.collect} {c.ui.egp} {DELIVERY.total}
              </span>
            </div>
            <div className='mt-[10px] text-[17px] font-bold'>Mariam Adel</div>
            <div className='mt-[2px] flex items-start gap-[6px] text-[14px] text-slate-600'>
              <MapPin size={16} className='mt-[2px] shrink-0' />
              {c.rider.address}
            </div>
            <div className='mt-[12px] flex gap-[8px]'>
              <span className='flex h-[40px] flex-1 items-center justify-center gap-[6px] rounded-[12px] bg-slate-100 text-[14px] font-semibold'>
                <PhoneIcon size={15} /> {c.rider.call}
              </span>
              <span className='flex h-[40px] flex-1 items-center justify-center gap-[6px] rounded-[12px] bg-slate-100 text-[14px] font-semibold'>
                <Navigation size={15} /> {c.rider.map}
              </span>
            </div>

            <ol className='mt-[16px] flex flex-col gap-[10px]'>
              {STEPS.map((s, i) => (
                <li key={s} className='flex items-center gap-[10px] text-[15px]'>
                  <span className={cn('grid size-[24px] place-items-center rounded-full transition-colors', i <= at ? 'bg-[#0d9488] text-white' : 'bg-slate-200')}>
                    {i <= at && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className={cn('font-semibold', i > at && 'text-slate-400')}>{c.rider.steps[s]}</span>
                </li>
              ))}
            </ol>

            <AnimatePresence mode='wait' initial={false}>
              <motion.button
                key={step}
                type='button'
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                onClick={() => onStep(done ? 'assigned' : STEPS[at + 1])}
                className={cn('mt-[16px] h-[52px] w-full rounded-[14px] text-[16px] font-bold', done ? 'bg-slate-100' : 'bg-[#0d9488] text-white')}
              >
                {done ? c.rider.next : c.rider.actions[step]}
              </motion.button>
            </AnimatePresence>
          </div>
        ) : (
          <div className='mt-[14px] rounded-[20px] bg-white p-[20px] text-[15px] leading-[1.5] text-slate-500 ring-1 ring-slate-200'>{c.rider.offNote}</div>
        )}
      </div>
    </Phone>
  )
}
