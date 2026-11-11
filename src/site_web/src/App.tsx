import { LangProvider, type Lang } from '@/lib/lang'
import { Footer, Header } from '@/sections/chrome'
import { Call, Hero, Moments, Plans } from '@/sections/page'

/**
 * The page: Ninja shown, not described. The apps on it are the real ones,
 * running by themselves on a sample café, with a few words beside each.
 */
export function App({ lang }: { lang: Lang }) {
  return (
    <LangProvider lang={lang}>
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
