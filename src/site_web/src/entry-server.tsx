import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { CONTACT } from '@/content/contact'
import { contentFor, metaFor, type Lang } from '@/lib/lang'
import { pathOf, type Page } from '@/lib/pages'
import { App } from './App'

const SITE = 'https://ninjapp.net'

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * What the page is, said the way a search engine reads it: who Ninja is and how to reach it, and the
 * software itself, for which kinds of business, free to start. `<` is written as its escape so nothing
 * in the words can close the script tag.
 */
function structured(lang: Lang, page: Page, url: string): string {
  const c = contentFor(lang)
  const meta = metaFor(lang, page)
  const organization = {
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: 'Ninja',
    url: `${SITE}/`,
    logo: `${SITE}/brand/ninja-mark-512.png`,
    email: CONTACT.email,
    contactPoint: { '@type': 'ContactPoint', contactType: 'sales', telephone: `+${CONTACT.whatsapp}`, availableLanguage: ['en', 'ar'] },
  }
  const software = {
    '@type': 'SoftwareApplication',
    name: 'Ninja',
    url,
    inLanguage: lang,
    description: meta.description,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Point of sale and restaurant management',
    operatingSystem: 'Web, Android, iOS',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EGP', name: c.plans.names.Free },
    publisher: { '@id': `${SITE}/#organization` },
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [organization, software] }).replace(/</g, '\\u003c')
}

/** A page as HTML, for scripts/prerender.mjs: what goes in #root and what goes in <head> */
export function render(lang: Lang, page: Page = 'home'): { app: string; head: string } {
  const meta = metaFor(lang, page)
  const url = SITE + pathOf(lang, page)
  // The picture a shared link shows: scripts/share-card.mjs draws one per language
  const card = `${SITE}/brand/share-${lang}.png`
  const head = [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="en" href="${SITE + pathOf('en', page)}" />`,
    `<link rel="alternate" hreflang="ar" href="${SITE + pathOf('ar', page)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${SITE + pathOf('en', page)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    `<meta property="og:site_name" content="Ninja" />`,
    `<meta property="og:locale" content="${lang === 'ar' ? 'ar_EG' : 'en_US'}" />`,
    `<meta property="og:image" content="${card}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(meta.title)}" />`,
    `<meta name="twitter:description" content="${escape(meta.description)}" />`,
    `<meta name="twitter:image" content="${card}" />`,
    `<script type="application/ld+json">${structured(lang, page, url)}</script>`,
  ].join('\n    ')
  const app = renderToString(
    <StrictMode>
      <App lang={lang} page={page} />
    </StrictMode>
  )
  return { app, head }
}
