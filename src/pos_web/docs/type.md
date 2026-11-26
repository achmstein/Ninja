# The till's type

One rule: a piece of text says what it **is**, and takes its size, weight and
line height from that. Sizes and weights are not picked by hand on a screen.

The roles are utilities in `src/styles/index.css`.

| Role | Class | Size / weight | Use it for |
| --- | --- | --- | --- |
| Title | `type-title` | 20px bold | The name of a screen, a panel or a dialog. One per surface. |
| Heading | `type-heading` | 16px semibold | A part's heading inside a surface; the name that leads a row (a customer, a bill). |
| Body | `type-body` | 16px regular | What is read and typed: rows, fields, sentences, buttons' words. |
| Detail | `type-detail` | 14px regular | A row's second line, a dense list (the order's lines), what stands beside the main thing. |
| Caption | `type-caption` | 12px regular | A hint, a count, a time. Nothing on the till is smaller. |
| Label | `type-label` | 12px semibold, capitals | A quiet name over a group ("New", "Sent", "Recent"). |
| Figure | `type-figure` | 24px bold, tabular | The one figure a surface is about: the total, the clock. |

## What goes with a role

- **Colour is separate.** Secondary text adds `text-muted-foreground`; a role
  never sets a colour.
- **Emphasis inside a role** is one step of weight, no more: `font-medium` on
  Detail for an item's name, `font-semibold` on Body for a button's words.
  Never a different size.
- **Numbers that line up** (money, counts, clocks, phone numbers) add
  `tabular-nums`. A phone number or an amount also keeps `dir='ltr'`.
- **Buttons** take their size from their height: a 44–48px control is Body, a
  56px main action is `text-lg font-semibold`. That pair is the only size set
  outside the roles.
- **A long name is cut, never wrapped into the price:** `truncate` on one
  line, `line-clamp-2` where two are allowed (menu tiles, area names).
- **Arabic and English share every role.** The font changes with the
  language (`Alexandria` for Arabic, `Inter` otherwise); the sizes do not.

## Not to do

- No `text-[13px]` or any size typed as a number.
- No `text-lg` / `text-xl` / `font-bold` chosen to "make it stand out": pick
  the role that says what the text is.
- No text under 12px.

## Where it is applied

The order screen (`features/sale`), the customer search and the room strip
follow it. Other screens are moved over as they are worked on; a size or a
weight set by hand there is a leftover, not a pattern to copy.
