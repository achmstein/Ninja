import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { useLang } from '@/lib/lang'
import { runScript, type Script } from './driver'

/**
 * One of the real apps, running on the page. It is the app as it ships,
 * built into /demo/<app>/ and answered by the demo's service worker
 * (demo/sw.js) instead of a café's server, at the size its device has and
 * scaled to the room it is given. A visitor cannot operate it: a script
 * does, by tapping the app's own controls, for as long as it is on screen.
 */
export function LiveApp({ app, path = '', width, height, script, label, radius, className }: { app: string; path?: string; width: number; height: number; script: Script; label: string; radius?: string; className?: string }) {
  const { lang } = useLang()
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState<number | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(0)
  const [onScreen, setOnScreen] = useState(false)

  // The canvas is the device's own size; the page scales it to the width it has
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setScale(el.clientWidth / width)
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [width])

  // Fetched when it nears the screen, once the demo's server is answering
  useEffect(() => {
    const el = box.current
    if (!el) return
    let gone = false
    const coming = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        coming.disconnect()
        demoServer()
          .then(() => {
            if (!gone) setSrc(`/demo/${app}/${path}`)
          })
          .catch(() => {})
      },
      { rootMargin: '600px 0px' }
    )
    const showing = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.35 })
    coming.observe(el)
    showing.observe(el)
    return () => {
      gone = true
      coming.disconnect()
      showing.disconnect()
    }
  }, [app, path, lang])

  // The script plays while the app is on screen, and starts over when it comes back
  useEffect(() => {
    const el = frame.current
    if (!el || !loaded || !onScreen) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    return runScript(el, script)
  }, [loaded, onScreen, script])

  return (
    <div ref={box} role='img' aria-label={label} className={cn('relative w-full overflow-hidden bg-white [contain:paint]', className)} style={{ aspectRatio: `${width} / ${height}`, borderRadius: radius, clipPath: radius ? `inset(0 round ${radius})` : undefined }}>
      {src && scale !== null && (
        <iframe
          ref={frame}
          src={src}
          title={label}
          tabIndex={-1}
          aria-hidden
          onLoad={() => setLoaded((n) => n + 1)}
          className='pointer-events-none absolute top-0 left-0 origin-top-left border-0'
          style={{ width, height, transform: `scale(${scale})` }}
        />
      )}
    </div>
  )
}

let server: Promise<void> | null = null

/** The demo's service worker, registered once and awaited until it answers for /demo/ */
function demoServer(): Promise<void> {
  server ??= (async () => {
    if (!('serviceWorker' in navigator)) throw new Error('No service worker here')
    const registration = await navigator.serviceWorker.register('/demo/sw.js', { scope: '/demo/' })
    const worker = registration.active ?? registration.installing ?? registration.waiting
    if (!worker) throw new Error('The demo server did not start')
    if (worker.state === 'activated') return
    await new Promise<void>((resolve) => {
      worker.addEventListener('statechange', () => worker.state === 'activated' && resolve())
    })
  })()
  return server
}
