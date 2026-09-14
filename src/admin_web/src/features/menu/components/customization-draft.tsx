import {
  type ItemCustomization,
  type ProposedCustomization,
} from '@/api/catalog'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  fromLocalizedValue,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'

export type OptionRow = {
  name: LocalizedValue
  priceAdjustment: number
  isDefault: boolean
}

export const emptyOption: OptionRow = {
  name: { en: '', ar: '' },
  priceAdjustment: 0,
  isDefault: false,
}

/** A group as an editor holds it: what the assistant proposes, or what is typed */
export type DraftGroup = {
  name: LocalizedValue
  isRequired: boolean
  allowMultiple: boolean
  options: OptionRow[]
}

export function fromProposal(group: ProposedCustomization): DraftGroup {
  return {
    name: toLocalizedValue(group.name),
    isRequired: group.isRequired,
    allowMultiple: group.allowMultiple,
    options: group.options.map((option) => ({
      name: toLocalizedValue(option.name),
      priceAdjustment: Number(option.priceAdjustment),
      isDefault: option.isDefault,
    })),
  }
}

/** The create/update body from a draft; options without an English name are left out. */
export function bodyFromDraft(
  itemId: number,
  draft: DraftGroup,
  displayOrder: number
): ItemCustomization {
  return {
    catalogItemId: itemId,
    name: fromLocalizedValue(draft.name),
    isRequired: draft.isRequired,
    allowMultiple: draft.allowMultiple,
    displayOrder,
    options: draft.options
      .filter((option) => option.name.en.trim())
      .map((option, index) => ({
        name: fromLocalizedValue(option.name),
        priceAdjustment: option.priceAdjustment,
        isDefault: option.isDefault,
        displayOrder: index,
      })),
  }
}

// Free options show nothing — pricing only appears where it differs
export function formatAdjustment(
  value: number,
  t: ReturnType<typeof useT>
): string {
  if (!value) return ''
  return `${value > 0 ? '+' : '−'}${Math.abs(value)} ${t('currency')}`
}

/** Tiny radio/checkbox glyph: shape mirrors what the customer will see
 *  (circle = pick one, square = pick several); filled = default choice. */
export function ChoiceGlyph({
  multiple,
  selected,
}: {
  multiple: boolean
  selected: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'h-3 w-3 shrink-0 border transition-colors',
        multiple ? 'rounded-[3px]' : 'rounded-full',
        selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
      )}
    />
  )
}

/**
 * One of the assistant's proposals, read-only: the group, its kind and its
 * options as the customer will see them. What can be done with it is the
 * caller's `actions`, at the end of the title row.
 */
export function DraftCard({
  draft,
  actions,
}: {
  draft: DraftGroup
  actions: React.ReactNode
}) {
  const t = useT()
  const localized = useLocalized()

  return (
    <div className='bg-background rounded-md border p-2.5'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <h4 className='truncate text-sm font-semibold'>
            {localized(draft.name)}
          </h4>
          <p className='text-muted-foreground text-xs'>
            {draft.isRequired ? t('required') : t('optional')}
            {' · '}
            {draft.allowMultiple ? t('multipleChoice') : t('singleChoice')}
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-0.5'>{actions}</div>
      </div>
      <div className='mt-2 flex flex-col gap-1.5'>
        {draft.options.map((option, index) => (
          <div key={index} className='flex items-center gap-2.5 text-sm'>
            <ChoiceGlyph
              multiple={draft.allowMultiple}
              selected={option.isDefault}
            />
            <span className='min-w-0 flex-1 truncate'>
              {localized(option.name)}
            </span>
            <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
              {formatAdjustment(option.priceAdjustment, t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
