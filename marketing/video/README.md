# Ninja videos

Two videos made with [Remotion](https://remotion.dev), built in code from assets kept in `public/`: no recordings and no running stack. The screens are the Ninja apps redrawn at their real sizes, with their real labels, colours and fonts. Reality comes from real images:
- the dishes are the app's own menu photos (`public/dishes`, from `src/Catalog.API/Pics`)
- the printed menu and the supplier's receipt are the explainer's photos (`public/paper-menu.jpg`, `public/supplier-receipt.jpg`)
- the devices have a status bar, screen glare and a slight 3D turn toward the copy

The fonts follow the apps:
- Plus Jakarta Sans and the slab dock for the guest app
- Inter for the till, the kitchen and the rider app
- Geist for the owner's dashboard
- Original Surfer for the wordmark only

| Composition | Size | Length | For |
|---|---|---|---|
| **Tour** | 1920 × 1080 | 1:57 | Café owners: every feature idea, chapter by chapter (YouTube, the website, sales calls) |
| **TourAr** | 1920 × 1080 | 1:57 | The same tour in Arabic, right to left: the stage is mirrored and every app shows its own Arabic interface (strings from the apps' translation files, each app's Arabic font, prices as ج.م) |
| **Promo** | 1080 × 1920 | 0:22 | Reels, TikTok, Shorts: order → kitchen → rider → ask your café |

## The tour (`src/tour/`)

Each chapter has the copy on the left (number, who it is for, title, one line, chips) and the app on the right. The styles come from the public Claude motion-graphics libraries: Apple-style light chapters, liquid-glass chapters, and a dark "precise reel" look for the till and kitchen.

| # | Chapter | Shows |
|---|---|---|
| — | Intro | "Your whole café, in one place.": the lineup of every app (dashboard, till, kitchen display, guest app on iOS/Android/web, rider app), each labelled, and the features in one line |
| 01 | Your brand | Quick cuts through all six menu layouts, each cut changing the brand colour too, the Theme card following along |
| 02 | One order, every app | Lina's order #1042 in one take: she orders on the mobile app (photos fly into the dock, Place Order) → the order card flies to the till (Confirm, assign rider Mostafa) → to the kitchen (the ticket lands, Ready) → to the rider app (I'm on the way, Delivered), while her phone in the corner shows each status |
| 03 | Pay & split | The dock's bill row opens "Your bill" → Split bill → Pay for your items (her items ticked) → Pay → "Paid, thank you!" |
| 04 | Reservations | Table 4: Reserve Now morphs to a tick, the Book tab becomes "Held for you" with the ring and rolling 10-minute countdown |
| 05 | Loyalty | Points ring and tier, recent activity |
| 06 | Branches | Admin Branches; the guest's nearest branch |
| 07 | Menu scan | A printed menu read by Ninja into the admin Menu; the photo studio turns a phone snap into the dish photo |
| 08 | Stock & food cost | A supplier's receipt into stock; Menu cost with margins and "Over target" |
| 09 | Profit & payroll | Profit & loss waterfall |
| 10 | Ask your café | Claude or ChatGPT connected to ninja: lowest margins, then a drafted and confirmed change |
| — | End card | A bento grid of every feature folding into the N mark, `ninja` and ninjapp.net |

Every chapter carries the Ninja badge (N mark and `ninja`) top left, the owner's dashboard says "Powered by ninja", and the guest app wears the café's own brand. A label over each phone says whether it is the mobile app or the web. Chapters cut with `pushCut` (a quick zoom-cut with a soft flash). Devices face the viewer flat with a light glare.

The Arabic captions live in `src/tour/lang.ts` and the apps' Arabic interface in `src/tour/ar-ui.ts` (from the apps' own translation files); `<Tour lang="ar">` switches both and mirrors the stage. The café is Chillax (its own logo, in both languages); the guest is Lina.

`ui.tsx` holds the app kit (guest phone, dock, bill row, admin shell, stat strip, device screens, taps). `menu-screen.tsx` holds the guest menu, `chapter.tsx` the chapter layout, `Frame.tsx` the backdrops and the copy column. `Tour.tsx` strings the chapters together.

## The promo (`src/Promo.tsx`, `src/scenes/`)

Six apps collapse into the N mark → a guest scans Table 3 and orders → the kitchen marks it ready → the café's own rider delivers → the owner asks Claude or ChatGPT, connected to ninja, for the lowest margins → the end card ("Order. Cook. Deliver. Ask.").

The video says Ninja, never "AI", for Ninja's own smarts (the owner's rule).

## Commands

```
npm i
npm run dev                                       # Remotion Studio: preview, scrub, edit each chapter's text
npx remotion render Tour out/ninja-tour.mp4       # out/ is git-ignored
npx remotion render TourAr out/ninja-tour-ar.mp4
npx remotion render Promo out/ninja-promo.mp4
npx remotion still TourStock out/frame.png --frame=160
```

Every chapter is also its own composition (folders **Tour-Scenes** and **Promo-Scenes** in Studio), so it can be previewed and rendered alone.

**Music:** `public/tour-music-hype.mp3`, a high-energy tech-launch instrumental (Artlist, Lyria 3 Pro, 126 BPM), fades in over 0.4 s and out over the last 3 s. The calmer first track is kept as `public/tour-music.mp3`. The promo has no music yet.

Remotion is free for individuals and companies of up to three people; larger companies need a company licence.
