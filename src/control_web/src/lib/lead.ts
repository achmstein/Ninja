import type { LeadDto } from '@/api/control'

type Origin = Pick<LeadDto, 'ref' | 'source' | 'medium' | 'campaign' | 'referrer'>

/**
 * Where a request came from, in one line: the business that sent it first,
 * then the campaign's tags, and the site before ours only when neither says.
 */
export function leadOrigin(lead: Origin): string | null {
  const parts = [
    lead.ref ? `recommended by ${lead.ref}` : null,
    lead.source,
    lead.medium,
    lead.campaign,
    !lead.source && !lead.ref ? lead.referrer : null,
  ].filter((p): p is string => Boolean(p && p.trim()))
  return parts.length === 0 ? null : parts.join(' / ')
}

/**
 * A phone as wa.me wants it: digits only, in international form. A number
 * typed the local Egyptian way (01…) gets Egypt's code; one with a plus or a
 * code already is left as it is.
 */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (phone.trim().startsWith('+')) return digits
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `20${digits.slice(1)}`
  return digits
}

/** Whether a name is written in Arabic letters: which side of a two-language name it goes on. */
export const isArabic = (text: string) => /[؀-ۿ]/.test(text)
