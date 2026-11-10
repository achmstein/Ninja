import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'

const FilmPlayer = lazy(() => import('@/film/film-player'))

/**
 * A part of Ninja at work: one of the film's scenes, playing by itself as
 * HTML, in the page's language, with nothing for the visitor to operate. Its
 * still shows first; the scene is loaded when it nears the screen and plays
 * only while it is on it. Anyone who asked for less motion keeps the still.
 */
export function Clip({ name, label, ratio, className }: { name: string; label: string; ratio: string; className?: string }) {
  const { lang } = useLang()
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [onScreen, setOnScreen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const coming = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: '500px 0px' })
    const showing = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.3 })
    coming.observe(el)
    showing.observe(el)
    return () => {
      coming.disconnect()
      showing.disconnect()
    }
  }, [])

  return (
    <div ref={ref} role='img' aria-label={label} className={cn('relative w-full overflow-hidden bg-[#eceef2]', className)} style={{ aspectRatio: ratio }}>
      <img src={`/clips/${name}-${lang}.webp`} alt='' loading='lazy' className='absolute inset-0 size-full object-cover' />
      {near && (
        <Suspense fallback={null}>
          <FilmPlayer name={name} lang={lang} playing={onScreen} />
        </Suspense>
      )}
    </div>
  )
}
