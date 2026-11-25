# Ninja courier API

What a courier company builds so that restaurants and cafés on Ninja can hand it deliveries. Every
Ninja business is its own system with its own address (`https://api.<business>.ninjapp.net`); a
company connects to each business that chooses it, the same way, with that business's key and secret.

There are two directions:

1. **Ninja calls the company** to send a job and to cancel one (section 2). The company runs these
   two endpoints.
2. **The company calls Ninja** with each status of a job: who it sent, picked up, delivered with the
   cash collected, could not deliver, brought back, gave it up (section 3).

## 1. Connecting a business

In Ninja's admin, the business lists the company (**Courier companies**), opens it, and under
**Connection**:

- enters the **address of the company's system**: the base the two endpoints below sit under,
  `https://` only (for example `https://api.fastcouriers.example/ninja`);
- enters the **key the company gave it**: Ninja sends it as `Authorization: Bearer <key>` on every
  call, so the company knows which business is calling. Ninja keeps it sealed and never shows it again;
- makes a **signing secret** (`whsec_…`), shown once, and gives it to the company with the
  **status address** shown beside it
  (`https://api.<business>.ninjapp.net/api/orders/couriers/<id>/status?api-version=1.0`).

The company stores, per business: the key it issued, the signing secret and the status address.
Making a new secret replaces the old one at once.

To try the connection, the owner presses **Send a test job**: Ninja sends a job marked `"test": true`,
with nothing to deliver and nothing to collect, then cancels it, and shows what the company answered
and how fast. The company must answer it like a real job but send nobody. It may then send statuses
for that job id: Ninja checks the signature and the body, answers `200`, and moves no order. The
company's page lists its last fifty status calls (kept two weeks) with the code each was answered,
so a wrong secret or a clock off shows as `401` there.

## 2. Ninja calls the company

All bodies are JSON, camelCase. Ninja waits 15 seconds for an answer.

### Send a job: `POST {address}/jobs`

Sent when the till gives the delivery to the company. Headers: `Authorization: Bearer <key>`,
`Idempotency-Key: ninja-<orderId>-<n>`; the same key means the same hand-over, so a job sent again
after a timeout must return the job already made, not a second one.

```json
{
  "orderId": 4182,
  "reference": "3-4182",
  "callbackUrl": "https://api.blue.ninjapp.net/api/orders/couriers/2/status?api-version=1.0",
  "pickup": {
    "name": "Zamalek", "nameAr": "الزمالك",
    "address": "26 July St", "addressAr": "شارع ٢٦ يوليو",
    "phone": "+20225550000", "latitude": 30.0612, "longitude": 31.2197
  },
  "dropoff": {
    "name": "Mona", "phone": "+201001234567",
    "address": "Qasr El Nil St", "building": "12", "floor": "3", "apartment": "7",
    "directions": "Blue door", "latitude": 30.06, "longitude": 31.245
  },
  "cashToCollect": 140.00,
  "items": [{ "name": "Family meal", "quantity": 2 }]
}
```

- `test` is `true` only for a test job sent from admin (see section 1); `orderId` is `0` then.
- `cashToCollect` is what the courier collects at the door, in the business's currency; `0` when
  the customer paid online.
- Pickup fields can be missing for a business that has not filled them in; dropoff coordinates can
  be missing for an address typed at the till.

Answer `2xx` with the job:

```json
{ "jobId": "FC-88231", "trackingUrl": "https://track.fastcouriers.example/FC-88231", "fee": 35.00 }
```

- `jobId` is required: every status names it.
- `fee`, when given, is what the company charges the business for this delivery (otherwise the
  usual fee the business set is used). It is booked as the business's cost.
- Any other answer, or none within 15 seconds, and the till is told the company did not take it;
  nothing is given.

### Cancel a job: `POST {address}/jobs/{jobId}/cancel`

Sent when the till takes the delivery back, or gives it to a rider or another company, before it
left, or when the order's bill is voided. Body `{ "orderId": 4182, "reason": "taken_back" }` (`taken_back`, `reassigned` or `order_voided`). Answer
`2xx`, or `404` for a job it does not know. Any other answer, or none, and Ninja sends it again: after
15 seconds, then less often (never more than 15 minutes apart), for a day. A `4xx` other than `408`,
`409` or `429` is taken as refused for good and not sent again. Any status for a cancelled job is
answered `410` (below).

## 3. The company calls Ninja: `POST {status address}`

One call per status, in order, to the status address of the business that sent the job.

### Signing

Every call carries:

- `X-Ninja-Timestamp`: now, in Unix seconds. More than five minutes away from Ninja's clock and the
  call is refused.
- `X-Ninja-Signature`: `sha256=` and the lowercase hex HMAC-SHA256 of `<timestamp>.<raw body>`,
  keyed with the signing secret. Sign the exact bytes sent.

```js
const body = JSON.stringify(status)
const timestamp = Math.floor(Date.now() / 1000).toString()
const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
```

### Body

```json
{
  "jobId": "FC-88231",
  "orderId": 4182,
  "sequence": 3,
  "status": "delivered",
  "courierName": "Karim",
  "courierPhone": "+201112223334",
  "trackingUrl": "https://track.fastcouriers.example/FC-88231",
  "collected": 140.00,
  "reason": null
}
```

- `sequence` is the company's own count for the job, from 1, rising with each status. A status at
  or below the last one Ninja applied is answered `200` and ignored, so a status may be sent again
  safely. A status for a new job counts from 1 again.
- `courierName`, `courierPhone`, `trackingUrl` are optional on any status; what is left out stays
  as it was.

| `status` | Meaning | What Ninja does |
| --- | --- | --- |
| `assigned` | A courier is on it | The till and the customer see the courier's name |
| `picked_up` | The courier left the branch with it | On its way |
| `delivered` | Handed over; `collected` is the cash taken | Delivered. The bill is settled to the company, which owes the business the cash (`collected` is required unless the customer paid online). Less than the bill leaves it open at the till |
| `failed` | Could not hand it over; `reason` says why | Not delivered. The company's fee is still owed |
| `returned` | Brought back to the branch | Back at the branch |
| `cancelled` | The company gives the job up before pickup | Back with the till, to give to someone else |

A status may skip ahead: `delivered` without `picked_up` first is taken as both.

### Answers

| Code | Meaning | The company should |
| --- | --- | --- |
| `200` | Applied, or sent again | Move on |
| `400` | Not a status (missing `jobId`, `sequence` or `status`, an unknown status, no `collected`) | Fix it; do not resend as is |
| `401` | Signature or timestamp wrong | Check the secret and the clock |
| `404` | No such connected company at this address | Check the status address; the business may have disconnected it |
| `409` | A step the order cannot take now (for example `cancelled` after pickup) | Send the status that is true instead |
| `410` | Not the company's job any more: taken back, given to someone else, or its bill voided | Stop the job |
| `429` | More than 600 statuses a minute to this business | Slow down and send it again |
| `503`, `5xx`, no answer | Ninja was busy | Send the same status again, with backoff |

## 4. Money

What the business and the company owe each other is kept by the business on the company's page in
Ninja: what its couriers collected, less its fees, less money settled either way. How and when the
company pays the business is agreed between them.
