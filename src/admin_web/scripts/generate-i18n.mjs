// Generates the typed translation dictionary from the Flutter admin app's
// ARB files, so web and mobile admin share the exact same strings
// (Egyptian Arabic included).
//
// Usage: npm run generate:i18n
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const arbDir = join(here, '..', 'i18n')
const outFile = join(here, '..', 'src', 'lib', 'i18n.gen.ts')

const en = JSON.parse(readFileSync(join(arbDir, 'app_en.arb'), 'utf8'))
const ar = JSON.parse(readFileSync(join(arbDir, 'app_ar.arb'), 'utf8'))
// Modern Standard Arabic, for a café that speaks it; app_ar.arb is Egyptian
const standardFile = join(arbDir, 'app_ar_standard.arb')
const arStandard = existsSync(standardFile) ? JSON.parse(readFileSync(standardFile, 'utf8')) : {}

// ICU plural, possibly embedded mid-message:
// "{count} {count, plural, =1{item} other{items}}"
const PLURAL_HEAD = /\{(\w+),\s*plural,/

function parsePlural(message) {
  const head = message.match(PLURAL_HEAD)
  if (!head) return null
  const start = head.index
  const forms = {}
  let i = start + head[0].length
  // Forms contain nested placeholders like {count}, so walk braces by depth
  while (i < message.length) {
    const selector = message
      .slice(i)
      .match(/^\s*(=\d+|zero|one|two|few|many|other)\s*\{/)
    if (!selector) break
    i += selector[0].length
    const formStart = i
    let depth = 1
    while (i < message.length && depth > 0) {
      if (message[i] === '{') depth++
      else if (message[i] === '}') depth--
      i++
    }
    forms[selector[1]] = message.slice(formStart, i - 1)
  }
  // Consume the plural block's closing brace, then inline the surrounding
  // text into each form so the runtime only ever substitutes placeholders
  while (i < message.length && /\s/.test(message[i])) i++
  const end = message[i] === '}' ? i + 1 : i
  const prefix = message.slice(0, start)
  const suffix = message.slice(end)
  const expanded = {}
  for (const [selector, form] of Object.entries(forms)) {
    expanded[selector] = `${prefix}${form}${suffix}`
  }
  return { arg: head[1], forms: expanded }
}

const keys = Object.keys(en).filter((k) => !k.startsWith('@'))
const missingAr = []
const entries = []
const standardEntries = []

for (const key of keys) {
  const enMessage = en[key]
  const arMessage = ar[key]
  if (typeof enMessage !== 'string') continue
  if (typeof arMessage !== 'string') missingAr.push(key)

  const standardMessage = arStandard[key]
  if (typeof standardMessage === 'string') {
    const standardPlural = parsePlural(standardMessage)
    standardEntries.push(
      `  ${key}: ${JSON.stringify(standardPlural ? standardPlural.forms : standardMessage)},`
    )
  }

  const plural = parsePlural(enMessage)
  if (plural) {
    const arPlural = typeof arMessage === 'string' ? parsePlural(arMessage) : null
    entries.push(
      `  ${key}: { plural: ${JSON.stringify(plural.arg)}, en: ${JSON.stringify(plural.forms)}, ar: ${JSON.stringify(arPlural?.forms ?? plural.forms)} },`
    )
  } else {
    entries.push(
      `  ${key}: { en: ${JSON.stringify(enMessage)}, ar: ${JSON.stringify(typeof arMessage === 'string' ? arMessage : enMessage)} },`
    )
  }
}

if (missingAr.length > 0) {
  console.warn(
    `[generate-i18n] ${missingAr.length} key(s) missing in app_ar.arb (falling back to English): ${missingAr.join(', ')}`
  )
}

const output = `// Auto-generated from admin_web/i18n/app_{en,ar}.arb by
// scripts/generate-i18n.mjs — do not edit by hand; run \`npm run generate:i18n\`.

export type PluralForms = Record<string, string>

export type Message =
  | { en: string; ar: string }
  | { plural: string; en: PluralForms; ar: PluralForms }

export const messages = {
${entries.join('\n')}
} as const satisfies Record<string, Message>

/** Modern Standard Arabic, read instead of \`ar\` when the café speaks it. */
export const messagesArStandard: Partial<Record<keyof typeof messages, string | PluralForms>> = {
${standardEntries.join('\n')}
}
`

writeFileSync(outFile, output)
console.log(`[generate-i18n] Wrote ${entries.length} keys to src/lib/i18n.gen.ts`)
