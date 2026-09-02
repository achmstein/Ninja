import { DirectionProvider as RdxDirProvider } from '@radix-ui/react-direction'
import { useLanguage } from '@/lib/i18n'

/**
 * Direction follows the language directly on the POS (Arabic = RTL) — the
 * language store already stamps dir/lang on <html>; this only feeds the
 * Radix primitives so dropdowns and dialogs mirror along.
 */
export function DirectionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const language = useLanguage((s) => s.language)
  return (
    <RdxDirProvider dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {children}
    </RdxDirProvider>
  )
}
