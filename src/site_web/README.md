# site_web

The platform's own site at the bare domain (ninjapp.net): the home page in
English (`/`) and Arabic (`/ar`), with the privacy policy, terms and support
pages beside it (`public/*.html`, plain HTML at the addresses the sign-in
screens link to).

The home page shows Ninja at work and says little. Each part of the product
is a clip of the app doing its job by itself, silent and on a loop, with a
title of a few words; nothing on the page is operated by the visitor. The
clips are the film's own chapters (`marketing/video`), rendered one by one,
so the page, the films and the apps look the same.

```
npm run dev      the page at http://localhost:5173, Arabic at /ar
npm run test     the plans table against Plans.cs, and both languages' shape
npm run build    type-check, bundle, then render / and /ar to HTML in dist
npm run stills   remake each clip's still from marketing/video/out/web
```

- **Words**: `src/content/en.ts` and `ar.ts`, the same shape. Keep them few,
  and say only what is built and switched on. The plans table is
  `src/plans/plans.ts`, checked against `src/Control.API/Platform/Plans.cs`.
- **Clips**: `public/clips/<name>-<en|ar>.mp4` with a `.webp` still each, made
  by `bash marketing/video/scripts/render-web.sh` (all, or the ones named)
  and then `npm run stills`. A clip is fetched as it nears the screen and
  plays only while on it (`src/sections/clip.tsx`).
- **The film**: `public/film/ninja-<en|ar>.mp4`, the fast cut at 720p; the one
  thing with sound, so it has the browser's own controls and waits.
- **Contact**: `src/content/contact.ts` (WhatsApp number and email).
- **Shipping**: `deploy-platform.yml` builds it with the web apps and syncs
  `dist` into the server's `site/`, which Caddy serves at the bare domain.
