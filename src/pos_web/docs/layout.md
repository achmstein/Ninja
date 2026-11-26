# The till's pop-ups

A pop-up says what it **holds**, and takes its width from that. A width is
never set by hand (`max-w-*`) on a `DialogContent`: it is given a `size`.

| Size | Width | Use it for |
| --- | --- | --- |
| `sm` | 384px | A question and its answers: confirm, discard, a short notice. |
| `md` (default) | 448px | A few fields or a short list: the usual pop-up. |
| `lg` | 512px | A list to pick from, a form in steps, a keypad beside its figures. |
| `xl` | 768px | Two columns side by side: a report, a bill beside its payment. |

```tsx
<DialogContent size='lg'>…</DialogContent>
```

## What every pop-up does by itself

- **It never grows taller than the screen**: what does not fit scrolls inside
  it. Do not add `max-h-*` or `overflow-y-auto` to one.
- **On a phone it is a sheet from the bottom edge**, full width, whatever its
  size.
- **Its title is `type-title`**, one per pop-up (see `type.md`).

## Buttons side by side

- **Options of one choice are the same width** (percent or amount, counter or
  delivery), whatever their words.
- **A pop-up's answers are the same width**, the main one last.
- **A figure is typed without the browser's own arrows**: `type='text'` with
  `inputMode='decimal'`, never `type='number'`.

## What is not a pop-up

- **Finding a customer** takes the whole screen (`CustomerSearch`), so a
  tablet's keyboard never covers the box or its results. It is the one
  customer search on the till: a new sale, a round, a new bill, a room's
  people, a reservation and "find customer" all open it.
- **Taking payment** is a page of its own over the bill.
