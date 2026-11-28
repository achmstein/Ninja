import { configureCn } from '@ninja/web-core/cn'

export { cn } from '@ninja/web-core/cn'

// The kitchen display's type roles (styles/index.css, docs/type.md), told to the class merger
configureCn({
  typeRoles: [
    'type-place',
    'type-clock',
    'type-item',
    'type-detail',
    'type-quiet',
    'type-action',
    'type-tally',
    'type-body',
    'type-caption',
  ],
  conflicts: ['font-size', 'font-weight', 'leading', 'tracking'],
})
