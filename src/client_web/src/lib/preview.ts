/**
 * The control panel frames this app to show the owner their brand, and
 * asks for a language and a scheme in the query string. Read once at boot;
 * while a preview is on, nothing chosen here is remembered, so the frame
 * never changes what a real visitor on this browser sees.
 */
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
