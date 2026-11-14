import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { origin } from './lib/origin'
import './index.css'

// The address says which language: / is English, /ar is Arabic. A built page already
// carries it on its <html>; the dev server's one page is told here
const lang = window.location.pathname.replace(/\/+$/, '') === '/ar' ? 'ar' : 'en'
document.documentElement.lang = lang
document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
// Where this visit came from, noted on its first page while the address still says
origin()
const root = document.getElementById('root')!
const page = (
  <StrictMode>
    <App lang={lang} />
  </StrictMode>
)

// Built pages come with their HTML and are woken; the dev server's comes empty
if (root.firstElementChild) hydrateRoot(root, page)
else createRoot(root).render(page)
