import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { origin } from './lib/origin'
import { fromPath } from './lib/pages'
import './index.css'

// The address says which language and which page: / is English, /ar is Arabic, /cafes is the
// page for cafés. A built page already carries its language on its <html>; the dev server's one page is told here
const { lang, page } = fromPath(window.location.pathname)
document.documentElement.lang = lang
document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
// Where this visit came from, noted on its first page while the address still says
origin()
const root = document.getElementById('root')!
const tree = (
  <StrictMode>
    <App lang={lang} page={page} />
  </StrictMode>
)

// Built pages come with their HTML and are woken; the dev server's comes empty
if (root.firstElementChild) hydrateRoot(root, tree)
else createRoot(root).render(tree)
