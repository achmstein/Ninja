# Ninja promo video

A 22-second vertical (1080 × 1920) promo, drawn entirely in code with [Remotion](https://remotion.dev): no recordings, no running stack, no outside assets. The screens are drawn in Ninja's colours and fonts: Inter for the guest's phone and the kitchen, Geist for the owner's Ninja AI, and Original Surfer for the wordmark only.

| Time | Scene | File |
|---|---|---|
| 0–3 s | Six apps collapse into the N mark: "Run it on one." | `src/scenes/Hook.tsx` |
| 3–8 s | 01 · A guest scans Table 3's QR, adds two dishes, sends the order | `src/scenes/Order.tsx` |
| 8–11.5 s | 02 · The ticket lands on the kitchen screen and is marked ready | `src/scenes/Kitchen.tsx` |
| 11.5–15 s | 03 · The café's own rider drives the route, "Delivered" | `src/scenes/Rider.tsx` |
| 15–20 s | 04 · The owner asks Ninja AI for the lowest margins and drafts a price | `src/scenes/Assistant.tsx` |
| 20–22 s | Order. Kitchen. Delivery. AI. → N mark, `ninja`, ninjapp.net | `src/scenes/Outro.tsx` |

`src/Promo.tsx` strings the scenes together with transitions; `src/parts.tsx` holds the shared phone, tablet, tap, headline and backdrop; `src/theme.ts` the colours, fonts and easings.

## Commands

```
npm i
npm run dev                                       # Remotion Studio: preview, scrub, edit the text of each scene
npx remotion render Promo out/ninja-promo.mp4     # the MP4 (out/ is git-ignored)
npx remotion still Promo out/frame.png --frame=190
```

Every scene is also its own composition (folder **Promo-Scenes** in Studio), so it can be previewed and rendered alone. Remotion is free for individuals and companies of up to three people; larger companies need a company licence.
