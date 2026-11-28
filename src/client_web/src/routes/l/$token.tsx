import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Link2Off, Loader2, MapPin } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { getLocationShareStateOptions, shareLocationMutation } from '@ninja/api/ordering/@tanstack/react-query.gen'
import { useBrandName } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { blurSwap } from '@/lib/motion'
import { Button } from '@/components/ui/button'
import { DrawnCheck } from '@/components/motion/morph-button'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty, Slab } from '@/components/ninja/page/parts'

export const Route = createFileRoute('/l/$token')({
  component: ShareLocationPage,
})

/** Close enough to tell one door from the next: the watch stops here */
const DOOR_ACCURACY_METERS = 25

/** How long the phone is given to find a close fix before the best one so far is sent */
const WATCH_MS = 12_000

type Fix = { latitude: number; longitude: number; accuracy: number }

/**
 * Where the phone is, as close as it gets within a few seconds. The first fix
 * a phone gives is often a Wi-Fi or cell guess hundreds of metres out, so the
 * position is watched and the closest fix kept, until one is door-close or
 * the time is up.
 */
function locate(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unavailable'))
    let best: Fix | null = null
    const finish = () => {
      navigator.geolocation.clearWatch(watch)
      clearTimeout(timer)
      if (best) resolve(best)
      else reject(new Error('unavailable'))
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }
        if (!best || fix.accuracy < best.accuracy) best = fix
        if (fix.accuracy <= DOOR_ACCURACY_METERS) finish()
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          navigator.geolocation.clearWatch(watch)
          clearTimeout(timer)
          reject(new Error('denied'))
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: WATCH_MS }
    )
    const timer = setTimeout(finish, WATCH_MS)
  })
}

/**
 * A caller ordering by phone shares where they are, from the link the
 * cashier sent them on WhatsApp: one tap, the phone asks once, and the
 * rider is sent to the door. Open to anyone with the link; the page says
 * nothing of the order, the business only by name.
 */
function ShareLocationPage() {
  const t = useT()
  const name = useBrandName()
  const reduced = useReducedMotion()
  const { token } = Route.useParams()
  const [problem, setProblem] = useState<'denied' | 'unavailable' | 'failed' | null>(null)
  const [locating, setLocating] = useState(false)

  const state = useQuery({
    ...getLocationShareStateOptions({ path: { token } }),
    retry: false,
    staleTime: Infinity,
  })
  const share = useMutation({ ...shareLocationMutation(), onError: () => setProblem('failed') })

  const start = async () => {
    setProblem(null)
    setLocating(true)
    try {
      const fix = await locate()
      share.mutate({
        path: { token },
        body: { latitude: fix.latitude, longitude: fix.longitude, accuracyMeters: Math.round(fix.accuracy) },
      })
    } catch (error) {
      setProblem(error instanceof Error && error.message === 'denied' ? 'denied' : 'unavailable')
    } finally {
      setLocating(false)
    }
  }

  const title = t('shareLocationTitle')

  if (state.isPending)
    return (
      <NinjaPage title={title}>
        <div className='flex justify-center py-16'>
          <Loader2 className='text-muted-foreground size-6 animate-spin' aria-hidden />
        </div>
      </NinjaPage>
    )

  if (state.isError || !state.data?.open)
    return (
      <NinjaPage title={title}>
        <Empty icon={Link2Off} title={t('shareLocationExpired', { name })} />
      </NinjaPage>
    )

  const done = share.isSuccess
  const busy = locating || share.isPending
  const swap = blurSwap(reduced)

  return (
    <NinjaPage title={title}>
      <Rise className='flex flex-col gap-4'>
        <RiseItem>
          <Slab className='flex flex-col items-center gap-4 px-6 py-8 text-center'>
            <AnimatePresence mode='popLayout' initial={false}>
              {done ? (
                <motion.div key='done' className='flex flex-col items-center gap-3' {...swap}>
                  <span className='bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-full'>
                    <DrawnCheck reduced={!!reduced} className='size-8' />
                  </span>
                  <p className='text-title font-bold'>{t('shareLocationDone')}</p>
                  <p className='text-muted-foreground text-note'>{t('shareLocationDoneHint', { name })}</p>
                </motion.div>
              ) : (
                <motion.div key='ask' className='flex flex-col items-center gap-3' {...swap}>
                  <span className='bg-primary/10 text-primary flex size-16 items-center justify-center rounded-full'>
                    <MapPin className='size-8' aria-hidden />
                  </span>
                  <p className='text-title font-bold'>{t('shareLocationAsk', { name })}</p>
                  <p className='text-muted-foreground text-note'>{t('shareLocationWhy')}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!done && (
              <Button
                size='lg'
                className='mt-2 h-14 w-full max-w-sm rounded-full text-base font-bold'
                onClick={start}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className='size-5 animate-spin' aria-hidden />
                ) : (
                  <MapPin className='size-5' aria-hidden />
                )}
                {busy ? t('shareLocationFinding') : t('shareLocationButton')}
              </Button>
            )}

            {problem && (
              <p className='text-destructive text-note' role='alert'>
                {problem === 'denied'
                  ? t('shareLocationDenied')
                  : problem === 'unavailable'
                    ? t('shareLocationUnavailable')
                    : t('shareLocationFailed')}
              </p>
            )}
          </Slab>
        </RiseItem>
      </Rise>
    </NinjaPage>
  )
}
