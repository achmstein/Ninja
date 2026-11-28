import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { pillAction } from '@/components/ui/ninja-sheet'
import { usePhoneRule, showPhone } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import type { GuestContact } from '@/stores/guest-store'

/**
 * Whether this visit tries the account-by-phone flow: only in a development
 * build, and only when the address asks for it (`?preview-account`, kept for
 * the tab). There is nothing behind it yet: no code is sent, the order is not
 * placed. It exists so the flow can be seen in the real app, with a real
 * business's menu, before the sending account and the server side are built.
 */
export function accountPreview(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    if (new URLSearchParams(location.search).has('preview-account')) sessionStorage.setItem('nj_preview_account', '1')
    return sessionStorage.getItem('nj_preview_account') === '1'
  } catch {
    return false
  }
}

/** The one code the preview takes; a real one will come by message */
const PREVIEW_CODE = '4821'
const CODE_LENGTH = PREVIEW_CODE.length

type Step = 'phone' | 'code' | 'name'

/**
 * The account a customer makes with their number, asked for at the moment
 * they send their first order and never before: the number (unless the
 * order already carries one, as a delivery's address does), the code that
 * proves it is theirs, and a name if none was given. One field a step.
 *
 * Returns `ensurePhoneAccount()`, resolving to the name and number once the
 * code is right (null when they close it), and the dialog to render.
 */
export function usePhoneGate() {
  const [open, setOpen] = useState(false)
  const [known, setKnown] = useState<Partial<GuestContact>>({})
  const resolver = useRef<((contact: GuestContact | null) => void) | null>(null)

  const ensurePhoneAccount = (orderKnows: Partial<GuestContact> = {}): Promise<GuestContact | null> => {
    setKnown(orderKnows)
    setOpen(true)
    return new Promise((resolve) => {
      resolver.current = resolve
    })
  }

  const settle = (result: GuestContact | null) => {
    setOpen(false)
    resolver.current?.(result)
    resolver.current = null
  }

  const dialog = <PhoneGateDialog key={`phone-gate-${open}`} open={open} known={known} onSettle={settle} />
  return { ensurePhoneAccount, phoneGateDialog: dialog }
}

function PhoneGateDialog({
  open,
  known,
  onSettle,
}: {
  open: boolean
  known: Partial<GuestContact>
  onSettle: (contact: GuestContact | null) => void
}) {
  const t = useT()
  const country = usePhoneRule((s) => s.country)
  const phonePlaceholder = usePhoneRule((s) => s.placeholder)
  const knownPhoneOk = isValidPhone(known.phone ?? '', country)

  const [step, setStep] = useState<Step>(knownPhoneOk ? 'code' : 'phone')
  const [phone, setPhone] = useState(() => formatPhone(known.phone ?? '', country))
  const [name, setName] = useState(known.name ?? '')
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(false)
  const codeField = useRef<HTMLInputElement>(null)

  const phoneOk = isValidPhone(phone, country)
  const finish = (givenName: string) => onSettle({ name: givenName.trim(), phone: normalizePhone(phone, country) })

  // The code checks itself the moment its last digit lands: there is no button to press
  useEffect(() => {
    if (step !== 'code' || code.length < CODE_LENGTH) return
    if (code !== PREVIEW_CODE) {
      setWrong(true)
      setCode('')
      return
    }
    const id = setTimeout(() => (name.trim() ? finish(name) : setStep('name')), 450)
    return () => clearTimeout(id)
    // finish reads the latest fields; the step and the code are what this follows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSettle(null)}>
      {/* No auto-focus on opening: the keyboard would rise over the sheet before it is read */}
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        {step === 'phone' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('phoneGateTitle')}</DialogTitle>
              <DialogDescription>{t('phoneGateHint')}</DialogDescription>
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
                placeholder={phonePlaceholder || t('phoneNumber')}
                aria-label={t('phoneNumber')}
                type='tel'
                inputMode='tel'
                autoComplete='tel'
                // The digits read left to right, but the field sits with the others: on the right in Arabic
                dir='ltr'
                className='rtl:text-right'
              />
              <button type='submit' className={cn(pillAction, 'h-14')} disabled={!phoneOk}>
                {t('phoneGateSend')}
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('phoneGateCodeTitle')}</DialogTitle>
              <DialogDescription>
                {t('phoneGateCodeHint')}{' '}
                <bdi dir='ltr' className='text-foreground font-semibold'>
                  {showPhone(normalizePhone(phone, country))}
                </bdi>
                {!knownPhoneOk && (
                  <>
                    {' · '}
                    <button type='button' onClick={() => setStep('phone')} className='text-foreground font-semibold underline underline-offset-4'>
                      {t('phoneGateChange')}
                    </button>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className='flex flex-col gap-3'>
              {/* One real field under the boxes: the phone's own code suggestion fills it, and so does typing */}
              <label className='relative grid grid-cols-4 gap-3' dir='ltr'>
                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'text-title grid h-16 place-items-center rounded-2xl border-2 font-bold tabular-nums',
                      code.length === CODE_LENGTH ? 'border-primary bg-primary/10' : i === code.length ? 'border-primary' : 'border-border',
                    )}
                  >
                    {code[i] ?? ''}
                  </span>
                ))}
                <input
                  ref={codeField}
                  value={code}
                  onChange={(e) => {
                    setWrong(false)
                    setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
                  }}
                  aria-label={t('phoneGateCodeTitle')}
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  className='absolute inset-0 opacity-0'
                />
              </label>
              {wrong && (
                <p role='alert' className='text-destructive text-caption text-center'>
                  {t('phoneGateWrongCode')}
                </p>
              )}
              {/* The preview sends nothing: it says so, and gives the code it takes */}
              <button
                type='button'
                onClick={() => setCode(PREVIEW_CODE)}
                className='bg-muted text-muted-foreground text-caption rounded-2xl px-3 py-2 text-center'
              >
                {t('phoneGatePreview', { code: PREVIEW_CODE })}
              </button>
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('phoneGateNameTitle')}</DialogTitle>
              <DialogDescription>{t('phoneGateNameHint')}</DialogDescription>
            </DialogHeader>
            <form
              className='flex flex-col gap-3'
              onSubmit={(e) => {
                e.preventDefault()
                if (name.trim()) finish(name)
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('name')} aria-label={t('name')} autoComplete='given-name' maxLength={100} />
              <button type='submit' className={cn(pillAction, 'h-14')} disabled={!name.trim()}>
                {t('phoneGateDone')}
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
