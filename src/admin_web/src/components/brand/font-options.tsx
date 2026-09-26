import { type BrandFont } from '@/lib/brand-fonts'
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select'

/**
 * A font picker's options, each name in its own face: the text families
 * first, then the display faces under their own label, as they are meant
 * for headings and the café's name more than for a whole menu.
 */
export function FontOptions({ catalog, displayLabel }: { catalog: readonly BrandFont[]; displayLabel: string }) {
  const text = catalog.filter((f) => !f.display)
  const display = catalog.filter((f) => f.display)
  const item = (f: BrandFont) => (
    <SelectItem key={f.family} value={f.family} style={{ fontFamily: `'${f.family}'` }}>
      {f.family}
    </SelectItem>
  )
  return (
    <>
      {text.map(item)}
      {display.length > 0 && (
        <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel className='text-xs'>{displayLabel}</SelectLabel>
            {display.map(item)}
          </SelectGroup>
        </>
      )}
    </>
  )
}
