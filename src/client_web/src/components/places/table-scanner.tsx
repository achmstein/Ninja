import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import jsQR from 'jsqr'
import { CameraOff, QrCode } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * The table's id in a scanned code, when the code is one of this café's
 * place links (https://{customer host}/p/{id}); null for anything else. A
 * link to another café, or any other page, is not a table here.
 */
export function placeIdFromCode(text: string, origin: string): number | null {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    return null
  }
  if (url.origin !== origin) return null
  const match = /^\/p\/(\d+)\/?$/.exec(url.pathname)
  return match ? Number(match[1]) : null
}

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }

/** The browser's own QR reader where there is one (Android's Chrome); iOS has none, so jsQR reads the frames. */
function nativeDetector(): Detector | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  try {
    return Ctor ? new Ctor({ formats: ['qr_code'] }) : null
  } catch {
    return null
  }
}

/**
 * Scans a table's code with the camera, in the app. The phone's own camera
 * opens a scanned link in the browser, which an app installed to the home
 * screen is not (on an iPhone it does not even share its storage), so a
 * guest in the installed app had no way to their table. A code that is one
 * of this café's place links goes where the link would: /p/{id}.
 */
export function TableScanner({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const navigate = useNavigate()
  const video = useRef<HTMLVideoElement>(null)
  const [blocked, setBlocked] = useState(false)
  // Each opening starts afresh: reset while rendering, not in the effect
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setBlocked(false)
  }
  // No camera API at all (an old browser, or not a secure page)
  const unsupported = typeof navigator !== 'undefined' && !navigator.mediaDevices

  useEffect(() => {
    if (!open || unsupported) return
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const detector = nativeDetector()
    // A code that is not a table here says so once, not on every frame
    let refused = ''

    const found = (text: string) => {
      const id = placeIdFromCode(text, window.location.origin)
      if (id == null) {
        if (refused !== text) toast.error(t('invalidQrCode'))
        refused = text
        return false
      }
      stopped = true
      onOpenChange(false)
      navigate({ to: '/p/$placeId', params: { placeId: String(id) } })
      return true
    }

    const read = async () => {
      if (stopped) return
      const el = video.current
      if (el && el.readyState >= el.HAVE_ENOUGH_DATA && el.videoWidth > 0) {
        try {
          if (detector) {
            const codes = await detector.detect(el)
            if (codes.some((c) => found(c.rawValue))) return
          } else if (context) {
            // A smaller copy is plenty for a code held up to the camera, and far quicker to read
            const scale = Math.min(1, 640 / el.videoWidth)
            canvas.width = Math.round(el.videoWidth * scale)
            canvas.height = Math.round(el.videoHeight * scale)
            context.drawImage(el, 0, 0, canvas.width, canvas.height)
            const image = context.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
            if (code && found(code.data)) return
          }
        } catch {
          // A frame that could not be read; the next one will do
        }
      }
      frame = requestAnimationFrame(() => void read())
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((track) => track.stop())
          return
        }
        stream = s
        const el = video.current
        if (!el) return
        el.srcObject = s
        void el.play().catch(() => {})
        frame = requestAnimationFrame(() => void read())
      })
      .catch(() => setBlocked(true))

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4'>
        <DialogHeader>
          <DialogTitle>{t('scanTable')}</DialogTitle>
          <DialogDescription>{t('scanTableHint')}</DialogDescription>
        </DialogHeader>
        {blocked || unsupported ? (
          <div className='bg-muted text-muted-foreground flex aspect-square flex-col items-center justify-center gap-3 rounded-xl p-6 text-center text-sm'>
            <CameraOff className='h-8 w-8' />
            {t('cameraBlocked')}
          </div>
        ) : (
          <div className='relative aspect-square overflow-hidden rounded-xl bg-black'>
            {/* muted and playsInline: iOS plays a camera stream only inline and silent */}
            <video ref={video} muted playsInline autoPlay className='size-full object-cover' />
            <div aria-hidden className='pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)]' />
          </div>
        )}
        <Button variant='outline' className='w-full rounded-pill' onClick={() => onOpenChange(false)}>
          {t('cancel')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

/** The button that opens the scanner, for wherever a guest is told to scan their table. */
export function ScanTableButton({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'outline' }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size='lg' variant={variant} className={className} onClick={() => setOpen(true)}>
        <QrCode className='h-4 w-4' />
        {t('scanTable')}
      </Button>
      <TableScanner open={open} onOpenChange={setOpen} />
    </>
  )
}
