# Talabat integration

Ninja is one POS integration partner at Talabat (Delivery Hero's POS middleware). Every café goes through
that one integration; no café holds Talabat credentials.

## How it fits

```
Talabat middleware ──(signed HS512)──► control.{domain}/api/talabat ──(ninja-control token)──► café stack
café stack ──(relay key derived from its slug)──► control-api:8080/api/talabat/relay ──(Ninja's login)──► middleware
```

- **Orders in:** `POST /api/talabat/order/{remoteId}` → Ordering `POST /api/orders/talabat` (branch from the remote id).
  Lines are matched by the remote codes Ninja gave the menu (`item-{id}`, `option-{id}`), at what the customer paid.
  An unknown code is rejected at once as `MENU_ACCOUNT_SETTINGS`.
- **Order status out:** staff confirm → `order_accepted`; cancel/sold out → `order_rejected` with a reason; kitchen
  ready (Talabat's rider only) → preparation-completed. Queued in Ordering (`platformupdates`) and retried.
- **Talabat's status in:** cancelled → a waiting order is cancelled, an accepted one is marked; picked up → recorded.
- **Menu out:** Catalog builds each Talabat branch's catalog (prices and stock per branch) and pushes it 45 s after
  the last edit, when a branch is put on Talabat, when the owner presses Send, and when Talabat asks
  (`GET /api/talabat/menuimport/{remoteId}`). Talabat's import result comes back on the catalog callback.
- **Availability out:** a dish or option sold out/back at a branch goes at once (`catalog/items/availability`).
  A branch paused or opened in Ninja closes or opens it on Talabat (owner can turn that off).
- **Bills:** a Talabat order gets its own bill ("Talabat {code}"), VAT inside the price, no service. When Talabat
  pays the café (paid online, or Talabat's rider) it settles itself to the tender "Talabat"; cash the café collects
  (own rider or pickup, not prepaid) stays open for the till.

## Going live

1. **Partner access (once, Ninja):** NDA with Talabat; send a PGP public key through their credential form; decrypt
   the username, password and secret. Staging first.
2. **Platform `.env`:** `TALABAT_MIDDLEWARE_URL` (staging: `https://integration-middleware.stg.restaurant-partners.com`),
   `TALABAT_USERNAME`, `TALABAT_PASSWORD`, `TALABAT_SECRET`. Restart control-api, then upgrade (re-stamp) the stacks so
   Ordering and Catalog get the relay.
3. **Tell Talabat:** plugin base URL `https://control.{domain}/api/talabat`; whitelist nothing (Talabat calls in);
   the Middle East egress IPs are Talabat's, not ours.
4. **Per café:** Talabat's onboarding gives a chain code and vendor codes. In the control app, set the café's chain
   code (and the global entity if not the default: `HF_EG` for Egypt, `TB_{country}` in the Gulf). Register each
   branch at Talabat with remote id `{slug}-{branchId}`.
5. **Owner:** in the admin, Settings → Talabat, switch the branches on. The menu is sent; check the result there
   (and "what Talabat sees") before Talabat opens the vendor.

## Not yet

- Order modifications (Talabat's product-modification flow) and preparation-time adjustments.
- Talabat's rider-waiting warnings are logged, not shown.
- Talabat's vendor-availability webhook (Talabat closing a store itself) is acknowledged, not mirrored.
