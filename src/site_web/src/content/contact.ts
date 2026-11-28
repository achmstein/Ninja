/**
 * How a business reaches Ninja from the page. `whatsapp` is the number in
 * international form, digits only (20… for Egypt); while it is empty the
 * page offers email alone.
 */
export const CONTACT = {
  email: 'hello@ninjapp.net',
  whatsapp: '201110970097',
}

export const mailto = (subject: string) => `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}`

export const whatsappLink = (text: string) =>
  CONTACT.whatsapp ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}` : null
