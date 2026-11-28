# The kitchen display's type

The till's rule: a piece of text says what it **is**, and takes its size,
weight and line height from that. Sizes and weights are not picked by hand on
a screen. The sizes are the till's own (`src/pos_web/docs/type.md`), with the
same fonts and colours. Every role was once a step larger, for reading at
arm's length; the owner found the board loud and not premium, so a ticket is
carried by weight and colour, not by size.

The roles are utilities in `src/styles/index.css`, and the tablet's are
`KitchenType` in `src/kds_app/lib/core/theme/kitchen_type.dart`: the same
names, the same sizes.

| Role | Class | Size / weight | Use it for |
| --- | --- | --- | --- |
| Place | `type-place` | 17px semibold | Where a ticket goes: its one biggest line. A surface's own name (the history). |
| Clock | `type-clock` | 17px semibold, tabular | How long a ticket has waited, opposite the place and no larger than it: its colour says late. |
| Item | `type-item` | 16px medium | What is made: an item's name, and its count beside it. |
| Detail | `type-detail` | 14px regular | An item's options, what the customer asked for, the order's note, how a platform's order leaves. |
| Quiet | `type-quiet` | 13px regular | The ticket's number and who to call; the stations it is split between. |
| Action | `type-action` | 15px semibold | The words on a ticket's button; its one word of warning (Cancelled). |
| Tally | `type-tally` | 18px semibold, tabular | A count read across the kitchen: orders, late. |
| Body | `type-body` | 16px regular | The chrome round the board: a menu's row, a switcher's words. |
| Caption | `type-caption` | 12px regular | A count's name, a menu's heading. Nothing is smaller. |

## What goes with a role

- **Colour is separate.** Lateness is the clock's colour and the bar across
  the ticket's top; secondary text adds `text-muted-foreground`.
- **Emphasis inside a role** is one step of weight, no more: `font-bold` on
  Item for the count, `font-semibold` on Detail for what the customer asked
  for, `font-medium` on Detail for the order's note. Never a different size.
- **Numbers that line up** add `tabular-nums` (Clock and Tally already do).
- **Arabic and English share every role.**

## Not to do

- No `text-[19px]` or any size typed as a number, and no `text-lg` /
  `text-xl` chosen to make something stand out: pick the role.
- No text under 12px.
