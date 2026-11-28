import { Footer, Header } from '@/sections/chrome'
import { Call, Hero, Moments, Plans } from '@/sections/page'
import { LangProvider, type Lang } from '@/lib/lang'
import type { Page } from '@/lib/pages'

/**
 * The page: Ninja shown, not described. The apps on it are the real ones,
 * running by themselves on a sample café, with a few words beside each.
 */
export function App({ lang, page = 'home' }: { lang: Lang; page?: Page }) {
  return (
    <LangProvider lang={lang} page={page}>
      <Header />
      <main>
        <Hero />
        <Moments />
        <Plans />
        <Call />
      </main>
      <Footer />
    </LangProvider>
  )
}
