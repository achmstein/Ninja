import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'

/**
 * A canvas drawn at its own size in px (a phone's 390 × 844, a tablet's
 * 1280 × 800) and scaled to the width it is given, as the apps are in the
 * films. Before the script wakes, the scale comes from CSS alone where the
 * browser can divide lengths; once awake it is measured.
 */
export function Scaled({ w, h, children, className, style }: { w: number; h: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setK(el.clientWidth / w)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [w])
  return (
    <div ref={ref} className={cn('relative w-full overflow-hidden [container-type:inline-size]', className)} style={{ aspectRatio: `${w} / ${h}`, ...style }}>
      <div
        className='absolute top-0 left-0 origin-top-left'
        style={{ width: w, height: h, scale: k === null ? `tan(atan2(100cqw, ${w}px))` : String(k) }}
      >
        {children}
      </div>
    </div>
  )
}

const LIFT = '0 1px 2px rgb(0 0 0 / .05), 0 40px 70px -30px rgb(15 23 42 / .45)'

/** The light catching the glass */
const Glare = () => (
  <div
    aria-hidden
    className='pointer-events-none absolute inset-0 z-40'
    style={{ background: 'linear-gradient(115deg, rgb(255 255 255 / .14) 0%, rgb(255 255 255 / .03) 28%, transparent 42%)' }}
  />
)

/** The iOS status bar at the phone's own size */
function StatusBar({ dark }: { dark?: boolean }) {
  const ink = dark ? '#fff' : '#000'
  return (
    <div
      aria-hidden
      dir='ltr'
      className='pointer-events-none absolute inset-x-0 top-0 z-40 flex h-[44px] items-center justify-between pt-[4px] pr-[30px] pl-[34px] text-[16px] font-semibold'
      style={{ color: ink, fontFamily: "-apple-system, 'SF Pro Text', 'Inter Variable', sans-serif" }}
    >
      <span>9:41</span>
      <span className='flex items-center gap-[6px]'>
        <svg width='18' height='12' viewBox='0 0 18 12'>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 5} y={9 - i * 3} width='3' height={3 + i * 3} rx='1' fill={ink} />
          ))}
        </svg>
        <svg width='27' height='13' viewBox='0 0 27 13'>
          <rect x='0.5' y='0.5' width='23' height='12' rx='3.5' fill='none' stroke={ink} opacity='0.4' />
          <rect x='2' y='2' width='18' height='9' rx='2' fill={ink} />
          <rect x='24.5' y='4.5' width='1.5' height='4' rx='0.75' fill={ink} opacity='0.4' />
        </svg>
      </span>
    </div>
  )
}

export const PHONE = { w: 390, h: 844 }
const BEZEL = 14

/** A phone whose screen is 390 × 844 of its own px; `font` is the app's */
export function Phone({ children, className, font = 'var(--font-guest)', darkStatus }: { children: ReactNode; className?: string; font?: string; darkStatus?: boolean }) {
  const { dir } = useLang()
  const w = PHONE.w + BEZEL * 2
  const h = PHONE.h + BEZEL * 2
  return (
    <div className={cn('w-full', className)} style={{ borderRadius: `${(60 / w) * 100}% / ${(60 / h) * 100}%`, boxShadow: LIFT }}>
      <Scaled w={w} h={h} style={{ borderRadius: `${(60 / w) * 100}% / ${(60 / h) * 100}%` }}>
        <div className='absolute inset-0 rounded-[60px] bg-[#18181b] shadow-[inset_0_0_0_2px_#3f3f46]' />
        <div
          dir={dir}
          className='absolute overflow-hidden rounded-[48px] bg-white text-[#020617]'
          style={{ left: BEZEL, top: BEZEL, width: PHONE.w, height: PHONE.h, fontFamily: font }}
        >
          {children}
          <StatusBar dark={darkStatus} />
          <div aria-hidden className='absolute top-[11px] left-[140px] z-40 h-[30px] w-[110px] rounded-full bg-black' />
          <Glare />
        </div>
      </Scaled>
    </div>
  )
}

/** A tablet holding a canvas of `logical` px: the till, the kitchen screen */
export function Tablet({ logical, children, className, screen = '#fff' }: { logical: [number, number]; children: ReactNode; className?: string; screen?: string }) {
  const { dir } = useLang()
  const pad = Math.round(logical[0] * 0.017)
  const w = logical[0] + pad * 2
  const h = logical[1] + pad * 2
  const radius = `${((pad * 2.2) / w) * 100}% / ${((pad * 2.2) / h) * 100}%`
  return (
    <div className={cn('w-full', className)} style={{ borderRadius: radius, boxShadow: LIFT }}>
      <Scaled w={w} h={h} style={{ borderRadius: radius }}>
        <div className='absolute inset-0 bg-[#18181b] shadow-[inset_0_0_0_2px_#3f3f46]' style={{ borderRadius: pad * 2.2 }} />
        <div
          dir={dir}
          className='absolute overflow-hidden text-[#020617]'
          style={{ left: pad, top: pad, width: logical[0], height: logical[1], borderRadius: pad * 1.2, backgroundColor: screen, fontFamily: 'var(--font-staff)' }}
        >
          {children}
          <Glare />
        </div>
      </Scaled>
    </div>
  )
}

/** A browser window at an address, holding a canvas of `logical` px: the owner's dashboard */
export function Browser({ logical, address, children, className }: { logical: [number, number]; address: string; children: ReactNode; className?: string }) {
  const { dir } = useLang()
  const bar = 40
  return (
    <div
      className={cn('w-full overflow-hidden rounded-[1.2%/1.9%]', className)}
      style={{ boxShadow: '0 0 0 1px rgb(2 6 24 / .08), 0 40px 80px -24px rgb(2 6 24 / .35), 0 16px 32px -20px rgb(2 6 24 / .25)' }}
    >
      <Scaled w={logical[0]} h={logical[1] + bar}>
        <div dir='ltr' className='absolute inset-x-0 top-0 flex items-center gap-[7px] bg-[#eef0f3] px-[14px]' style={{ height: bar }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} className='size-[11px] rounded-full' style={{ backgroundColor: c }} />
          ))}
          <div className='mx-auto flex h-[24px] min-w-[300px] items-center justify-center rounded-[7px] bg-white px-[14px] text-[12px] text-[#62748e]' style={{ fontFamily: 'var(--font-sans)' }}>
            {address}
          </div>
          <span className='w-[47px]' />
        </div>
        <div
          dir={dir}
          className='absolute inset-x-0 overflow-hidden bg-white text-[#020618]'
          style={{ top: bar, height: logical[1], fontFamily: 'var(--font-sans)' }}
        >
          {children}
        </div>
      </Scaled>
    </div>
  )
}
