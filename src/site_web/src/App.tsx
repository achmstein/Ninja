import { LangProvider, type Lang } from '@/lib/lang'
import { Footer, Header } from '@/sections/chrome'
import { Call, Hero, Plans, Reel } from '@/sections/page'

/**
 * The page: Ninja at work, shown rather than described. Each part of it is a
 * scene of the app doing its job by itself, with a few words beside it.
 */
export function App({ lang }: { lang: Lang }) {
  return (
    <LangProvider lang={lang}>
      <Header />
      <main>
        <Hero />
        <Reel />
        <Plans />
        <Call />
      </main>
      <Footer />
    </LangProvider>
  )
}
