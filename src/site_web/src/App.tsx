import { MotionConfig } from 'motion/react'
import type { Lang } from '@/cafe/menu'
import { useCafeRunner } from '@/cafe/runner'
import { LangProvider } from '@/lib/lang'
import { Footer, Header } from '@/sections/chrome'
import { Hero } from '@/sections/hero'
import { AssistantSection, BrandSection, DeliverySection, GuestSection, OwnerSection, TeamSection } from '@/sections/product'
import { AppsSection, CallSection, EverythingSection, PlansSection, StartSection } from '@/sections/rest'

/** The page: one café, running, and every part of Ninja as a window onto it */
export function App({ lang }: { lang: Lang }) {
  useCafeRunner()
  return (
    <LangProvider lang={lang}>
      {/* Reduced motion: every spring on the page becomes an instant change */}
      <MotionConfig reducedMotion='user'>
        <Header />
        <main>
          <Hero />
          <BrandSection />
          <GuestSection />
          <TeamSection />
          <DeliverySection />
          <OwnerSection />
          <AssistantSection />
          <AppsSection />
          <EverythingSection />
          <PlansSection />
          <StartSection />
          <CallSection />
        </main>
        <Footer />
      </MotionConfig>
    </LangProvider>
  )
}
