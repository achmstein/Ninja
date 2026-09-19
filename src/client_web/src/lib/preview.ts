/**
 * The control panel frames this app to show the owner their brand, and
 * asks for a language and a scheme in the query string. Read once at boot;
 * while a preview is on, nothing chosen here is remembered, so the frame
 * never changes what a real visitor on this browser sees.
 */
import type { BrandThemeInput } from '@/lib/brand-theme'

export type PreviewScheme = 'light' | 'dark'
export type PreviewLanguage = 'en' | 'ar'

export type Preview = {
  active: boolean
  theme?: PreviewScheme
  language?: PreviewLanguage
}

function read(): Preview {
  if (typeof window === 'undefined') return { active: false }
  const params = new URLSearchParams(window.location.search)
  const theme = params.get('preview-theme')
  const lang = params.get('lang')
  const preview: Preview = { active: theme === 'light' || theme === 'dark' }
  if (preview.active) preview.theme = theme as PreviewScheme
  if (preview.active && (lang === 'en' || lang === 'ar')) preview.language = lang
  return preview
}

export const preview: Preview = read()

// The frame is a phone: the stylesheet hides scrollbars under this mark
if (preview.active) document.documentElement.dataset.preview = ''

/**
 * The panel framing this app posts the theme it is drafting, so the real
 * app paints unsaved seeds as they change; nothing is kept. Only a framer
 * can send (the customer site lets its control and admin hosts frame it),
 * and only the theme is taken from what it sends.
 */
const DRAFT_THEME = 'ninja:preview-theme'
const READY = 'ninja:preview-ready'

let drafted: BrandThemeInput | null = null

/** The theme the framing panel is drafting, or null to show the saved brand */
export const draftedTheme = () => drafted

/** Listens for the panel's drafts and tells it the frame is ready for one; returns the stop. */
export function onDraftedTheme(handler: (input: BrandThemeInput | null) => void): () => void {
  if (!preview.active || window.parent === window) return () => {}
  const listen = (e: MessageEvent) => {
    if (e.source !== window.parent) return
    const data = e.data as { type?: string; theme?: BrandThemeInput | null } | null
    if (!data || data.type !== DRAFT_THEME) return
    drafted = data.theme ?? null
    handler(drafted)
  }
  window.addEventListener('message', listen)
  window.parent.postMessage({ type: READY }, '*')
  return () => window.removeEventListener('message', listen)
}
