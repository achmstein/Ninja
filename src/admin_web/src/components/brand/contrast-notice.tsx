import { TriangleAlert } from 'lucide-react'
import { contrastIssues, MIN_CONTRAST, type BrandThemeInput, type ContrastIssue } from '@/lib/brand-theme'
import { useT, type TranslationKey } from '@/lib/i18n'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const PAIR_LABEL: Record<ContrastIssue['pair'], TranslationKey> = {
  foreground: 'contrastOnPage',
  primary: 'contrastOnPrimary',
  secondary: 'contrastOnAccent',
}

/** Which text-on-fill pairs the seeds leave hard to read, in which scheme; nothing when every pair passes. */
export function ContrastNotice({ input }: { input: BrandThemeInput }) {
  const t = useT()
  const issues = contrastIssues(input)
  if (issues.length === 0) return null
  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>{t('contrastLow', { min: MIN_CONTRAST })}</AlertTitle>
      <AlertDescription>
        <ul>
          {issues.map((issue) => (
            <li key={`${issue.scheme}-${issue.pair}`}>
              {t(PAIR_LABEL[issue.pair])} · {t(issue.scheme)} · {issue.ratio}:1
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
