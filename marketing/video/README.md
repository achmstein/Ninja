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
| **Tour** | 1920 × 1080 | 2:05 | Café owners: every feature idea, chapter by chapter (YouTube, the website, sales calls) |
| **TourAr** | 1920 × 1080 | 2:05 | The same tour with every caption in Egyptian Arabic, right to left (IBM Plex Sans Arabic); the app screens stay as they are |
| **Promo** | 1080 × 1920 | 0:22 | Reels, TikTok, Shorts: order → kitchen → rider → ask your café |

## The tour (`src/tour/`)

Each chapter has the copy on the left (number, who it is for, title, one line, chips) and the app on the right. The styles come from the public Claude motion-graphics libraries: Apple-style light chapters, liquid-glass chapters, and a dark "precise reel" look for the till and kitchen.

| # | Chapter | Shows |
|---|---|---|
| — | Intro | "Five apps. One café.": the lineup of every app (owner dashboard, till, kitchen display, guest app on iOS/Android/web, rider app), each labelled, and the features in one line |
| 01 | Your brand | The Theme card recolours the guest app; the list menu becomes the photo grid |
| 02 | Table ordering | On the web, nothing to install: QR scan → menu → each dish's photo flies into the dock → "Your order" rises from the dock → Place Order → "Sent · #42" → "Being made" |
| 03 | Pay & split | As the mobile app does it: the dock's bill row opens "Your bill" in a floating slab sheet → Split bill → Divide equally → Pay EGP 150.00 → "Paid, thank you!" |
| 04 | Reservations | As the mobile app does it: Table 4's card opens the hold form, Reserve Now morphs to a spinner and a tick, and the Book tab becomes the "Held for you" face: a 10-minute ring with rolling digits, the dock tab counting down too |
| 05 | Loyalty | Points ring and tier, recent activity |
| 06 | Till | Three taps into the current sale, Charge → paid |
| 07 | Kitchen | Table 3's ticket lands among aged tickets; Ready |
| 08 | Own delivery | Rider app: "I'm on the way" → "Delivered"; the guest's dock follows |
| 09 | Branches | Admin Branches; the guest's nearest branch |
| 10 | Menu scan | The Corner Café's printed menu read by Ninja into the admin Menu; the photo studio turns a phone snap into the dish photo |
| 11 | Stock & food cost | A supplier's receipt into stock; Menu cost with margins and "Over target" |
| 12 | Profit & payroll | Profit & loss waterfall: "Where the money went" |
| 13 | Ask your café | Claude or ChatGPT connected to ninja: lowest margins, then a drafted and confirmed change |
| — | End card | A bento grid of every feature (two photo tiles), folding into the N mark, `ninja` and ninjapp.net |

Every chapter carries the Ninja badge (N mark and `ninja`) top left, the owner's dashboard says "Powered by ninja", and the guest app wears the café's own brand. A label over each phone says whether it is the mobile app or the web. Chapters cut with `pushCut` (a quick zoom-cut with a soft flash). Devices face the viewer flat with a light glare.

The Egyptian Arabic words live in `src/tour/lang.ts`; `<Tour lang="ar">` switches every caption.

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

**Music:** `public/tour-music.mp3` is a 2:54 instrumental generated with Artlist (Lyria 3 Pro: warm electronic-pop, about 112 BPM, made for this tour). The tour starts it after its 1.5 s of lead-in silence, fades it in over 0.4 s, and fades it out over the last 3 s. The promo has no music yet.

Remotion is free for individuals and companies of up to three people; larger companies need a company licence.
