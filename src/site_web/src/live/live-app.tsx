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
export type Staff = {
  /** The app's sign-in client, which names where it keeps whoever is signed in */
  client: string
  /** Where the app keeps its language */
  language: string
}

export function LiveApp({
  app,
  path = '',
  width,
  height,
  script,
  label,
  staff,
  radius,
  className,
}: {
  app: string
  path?: string
  width: number
  height: number
  script: Script
  label: string
  /** A staff app: opened already signed in, in the page's language */
  staff?: Staff
  radius?: string
  className?: string
}) {
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
    // Open while it is near the screen and closed again when it is far: four apps at once is a lot to keep running
    const coming = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return setSrc(null)
        demoServer()
          .then(async () => {
            // The apps were never meant to share a browser's storage, and here they do (one site, four apps):
            // what another app kept under the same name would be read as this one's. Each starts from nothing
            for (const key of Object.keys(localStorage)) if (!key.endsWith('-language') && !key.startsWith('oidc.')) localStorage.removeItem(key)
            if (staff) {
              const [key, user] = await signedIn(staff.client)
              localStorage.setItem(key, user)
              localStorage.setItem(staff.language, JSON.stringify({ state: { language: lang }, version: 0 }))
            }
            if (!gone) setSrc(`/demo/${app}/${path}`)
          })
          .catch(() => {})
      },
      { rootMargin: '700px 0px' }
    )
    const showing = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.35 })
    coming.observe(el)
    showing.observe(el)
    return () => {
      gone = true
      coming.disconnect()
      showing.disconnect()
    }
  }, [app, path, lang, staff])

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

/** Whoever is signed in at a staff app, from the demo's server: the key the app reads and what it finds there */
function signedIn(clientId: string): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    const worker = navigator.serviceWorker.controller ?? null
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => resolve(event.data as [string, string])
    navigator.serviceWorker.getRegistration('/demo/').then((registration) => {
      const to = registration?.active ?? worker
      if (!to) return reject(new Error('The demo server is not running'))
      to.postMessage({ type: 'staff', clientId }, [channel.port2])
    }, reject)
  })
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
