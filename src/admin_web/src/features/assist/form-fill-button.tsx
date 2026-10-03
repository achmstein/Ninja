import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { AiButton } from '@/components/ai-button'
import { fillBlocker, useFormFill, type FillField } from './use-form-fill'

/**
 * "Fill in with AI" for a whole form, in its sheet's header: one tap fills
 * every empty field the assistant can tell from what is typed, and says how
 * many it filled so they are checked before saving. Waits, saying why, until
 * something is typed and something is empty; hidden where there is no
 * assistant.
 */
export function FormFillButton({
  form,
  fields,
  onFilled,
}: {
  /** What the form makes, in plain English ("a supplier") */
  form: string
  fields: FillField[]
  /** Each filled key and its value, only for fields that were empty */
  onFilled: (values: Record<string, string>) => void
}) {
  const t = useT()
  const { fill, isPending, available } = useFormFill()
  if (!available) return null
  const blocker = fillBlocker(fields)

  return (
    <AiButton
      pending={isPending}
      disabled={!!blocker}
      why={blocker ? t(blocker) : undefined}
      onClick={async () => {
        try {
          const values = await fill(form, fields)
          const count = Object.keys(values).length
          if (count === 0) {
            toast.info(t('assistFilledNone'))
            return
          }
          onFilled(values)
          toast.success(t('assistFilledCount', { count }))
        } catch {
          // useFormFill has said what went wrong
        }
      }}
    >
      {t('assistFillIn')}
    </AiButton>
  )
}
