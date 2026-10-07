import { useState } from 'react'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AiButton } from '@/components/ai-button'
import { EntitySheet } from '@/components/entity-sheet'

/** The longest brief Inventory takes for one item (RecipeProposer.MaxBrief) */
const MAX_BRIEF = 1000

/**
 * "Propose with AI", told what the recipe is: the owner writes it the way
 * they would tell a new barista (what goes in, how much, what each option
 * changes) and the assistant builds it from the shelf, proposing what the
 * shelf lacks, each in the unit it is counted in. Left empty, it guesses
 * from the dish's name and options as before. Nothing is saved here: the
 * review sheet shows the result first.
 */
export function RecipeBriefSheet({
  open,
  onOpenChange,
  itemName,
  pending,
  onPropose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  pending: boolean
  onPropose: (brief: string) => void
}) {
  const t = useT()
  const [brief, setBrief] = useState('')

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('describeRecipe')}
      subtitle={itemName}
      actions={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <AiButton
            variant='default'
            pending={pending}
            onClick={() => onPropose(brief)}
          >
            {t('proposeRecipe')}
          </AiButton>
        </>
      }
    >
      <div className='flex flex-col gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t('describeRecipeHint')}
        </p>
        <Textarea
          autoFocus
          value={brief}
          maxLength={MAX_BRIEF}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t('describeRecipeExample')}
          className='min-h-36'
        />
        <p className='text-muted-foreground text-xs'>
          {t('describeRecipeEmpty')}
        </p>
      </div>
    </EntitySheet>
  )
}
