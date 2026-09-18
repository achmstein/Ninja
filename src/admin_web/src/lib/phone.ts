// A WhatsApp link for a phone as customers type it here: an Egyptian mobile
// (01xxxxxxxxx) gets its country code, an international one keeps its own.
// wa.me opens the chat in the WhatsApp app or the web client, nothing to
// integrate - staff message the customer from their own account.
export function whatsAppLink(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const international =
    digits.length === 11 && digits.startsWith('0')
      ? `20${digits.slice(1)}`
      : digits.startsWith('00')
        ? digits.slice(2)
        : digits
  return `https://wa.me/${international}`
}
