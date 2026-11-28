import { useRef, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { pillAction } from '@/components/ui/ninja-sheet'
import { useTheme } from '@/context/theme-provider'
import { usePhoneRule } from '@/lib/brand'
import { useLanguage, useT } from '@/lib/i18n'
import { loginPageParams } from '@/lib/oidc'
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/phone'
import { guestDetailsParams } from '@/lib/services/identity'
import { cn } from '@/lib/utils'
import type { GuestContact } from '@/stores/guest-store'

/**
 * Whether this visit sees the dock's preview panel (lib/dock-preview): only
 * in a development build, and only when the address asks for it
 * (`?preview-account`, kept for the tab).
 */
export function accountPreview(): boolean {
  if (!import.meta.env.DEV) return false
  return asked('preview-account', 'nj_preview_account')
}

/**
 * Whether this visit makes its account by phone at the first order, where a
 * guest's name and number were asked before. Off for everyone until codes
 * can really be sent (the customers' sign-in, src/keycloak-phone, has only
 * its test sender yet); a visit turns it on for itself with
 * `?phone-account`, kept for the tab, to try it with a test number.
 */
export function phoneAccountOn(): boolean {
  return asked('phone-account', 'nj_phone_account')
}

function asked(param: string, key: string): boolean {
  try {
    if (new URLSearchParams(location.search).has(param)) sessionStorage.setItem(key, '1')
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/** Set as the customer leaves to prove their number, so the order they were sending is open when they are back */
const RESUME_KEY = 'nj_order_after_sign_in'

/** Whether the customer left to sign in from an order about to be sent; asked once */
export function takeOrderResume(): boolean {
  try {
    const waiting = sessionStorage.getItem(RESUME_KEY) === '1'
    sessionStorage.removeItem(RESUME_KEY)
    return waiting
  } catch {
    return false
  }
}

/**
 * The account a customer makes with their number, asked for at the moment
 * they send their first order and never before. The number is the only thing
 * asked here, and not even that when the order already carries one (a
 * delivery's address does). Proving it is the sign-in's own business: the
 * customer goes to the business's sign-in page with the number named, a code
 * is sent to it, and the right code signs them in, the account made the
 * first time with the name they gave for the order (src/keycloak-phone).
 * They come back signed in, their order open as they left it.
 *
 * Returns `signInByPhone()`, which leaves the page (so it never resolves to
 * an order being sent), and the dialog to render.
 */
export function usePhoneGate() {
  const auth = useAuth()
  const { resolvedTheme } = useTheme()
  const language = useLanguage((s) => s.language)
  const country = usePhoneRule((s) => s.country)
  const [open, setOpen] = useState(false)
  const name = useRef('')

  const go = (phone: string) => {
    try {
      sessionStorage.setItem(RESUME_KEY, '1')
    } catch {
      // They come back to the menu instead of the open order
    }
    void auth.signinRedirect({
      login_hint: normalizePhone(phone, country),
      extraQueryParams: {
        ...loginPageParams(resolvedTheme, language).extraQueryParams,
        // The name they gave for the order names the new account; the phone is the hint itself
        ...guestDetailsParams({ name: name.current, phone: '' }),
      },
    })
  }

  const signInByPhone = (orderKnows: Partial<GuestContact> = {}) => {
    name.current = orderKnows.name ?? ''
    if (isValidPhone(orderKnows.phone ?? '', country)) go(orderKnows.phone!)
    else setOpen(true)
  }

  const dialog = <PhoneGateDialog key={`phone-gate-${open}`} open={open} onClose={() => setOpen(false)} onPhone={go} />
  return { signInByPhone, phoneGateDialog: dialog }
}

function PhoneGateDialog({ open, onClose, onPhone }: { open: boolean; onClose: () => void; onPhone: (phone: string) => void }) {
  const t = useT()
  const country = usePhoneRule((s) => s.country)
  const phonePlaceholder = usePhoneRule((s) => s.placeholder)
  const [phone, setPhone] = useState(() => formatPhone('', country))
  const [leaving, setLeaving] = useState(false)
  const phoneOk = isValidPhone(phone, country)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* No auto-focus on opening: the keyboard would rise over the sheet before it is read */}
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('phoneGateTitle')}</DialogTitle>
          <DialogDescription>{t('phoneGateHint')}</DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            if (!phoneOk || leaving) return
            setLeaving(true)
            onPhone(phone)
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
          <button type='submit' className={cn(pillAction, 'h-14')} disabled={!phoneOk || leaving}>
            {t('phoneGateSend')}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
