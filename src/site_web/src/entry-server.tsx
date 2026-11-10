import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import type { Lang } from '@/cafe/menu'
import { useCafe } from '@/cafe/store'
import { contentFor } from '@/lib/lang'
import { App } from './App'

const SITE = 'https://ninjapp.net'

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** A page as HTML, for scripts/prerender.mjs: what goes in #root and what goes in <head> */
export function render(lang: Lang): { app: string; head: string } {
  useCafe.getState().reset()
  const c = contentFor(lang)
  const url = lang === 'ar' ? `${SITE}/ar` : `${SITE}/`
  const head = [
    `<title>${escape(c.meta.title)}</title>`,
    `<meta name="description" content="${escape(c.meta.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="en" href="${SITE}/" />`,
    `<link rel="alternate" hreflang="ar" href="${SITE}/ar" />`,
    `<link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escape(c.meta.title)}" />`,
    `<meta property="og:description" content="${escape(c.meta.description)}" />`,
    `<meta property="og:image" content="${SITE}/brand/ninja-mark-512.png" />`,
  ].join('\n    ')
  const app = renderToString(
    <StrictMode>
      <App lang={lang} />
    </StrictMode>
  )
  return { app, head }
}
