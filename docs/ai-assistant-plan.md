# Chillax AI assistant — Design & Plan

**Goal:** take two chores off the back office — typing every menu text twice (English and Egyptian Arabic) and keying a supplier receipt line by line into "Receive stock" — with an assistant that proposes and a person who confirms.

**Status:** decided 2026-09-14; built the same day on the pattern dotnet/eShop uses for its AI.

---

## 1. Where we were

Every menu item, category and stock item carries a `LocalizedText` (En + Ar). The seed menu speaks an Egyptian café Arabic ("قهوة تركي", "شاي مصري تقليدي، زي ما بتحبه"), but a new item typed at the counter usually got one language and a warning dot on the other. Deliveries were keyed from a paper receipt into the receive dialog: pick the item, type the packs, type the total, again for each line.

The repo already carried the bones of an AI integration inherited from eShop — dead `AddOpenAI`/`AddOllama` helpers in the AppHost, `Experimental.Microsoft.Extensions.AI` in the telemetry sources, a commented `OpenAi` connection string — and nothing using them.

## 2. Decisions (owner, 2026-09-14)

### D1 — Free provider, swappable; Microsoft Agent Framework on top

The **Google Gemini API free tier** through its OpenAI-compatible endpoint (`gemini-2.5-flash`: text and vision in one model, about ten requests a minute and a few hundred a day). The provider is two settings and a key, so any OpenAI-compatible endpoint takes its place. The agents are **Microsoft Agent Framework** `ChatClientAgent`s over `Microsoft.Extensions.AI`'s `IChatClient`, one definition per feature, typed JSON answers.

### D2 — Follow eShop, exactly

- **AppHost** declares the model as an Aspire resource: `AddOpenAI("openai").WithEndpoint(…)` + `AddModel("chatModel", …)`; the projects that own a feature `.WithReference(chatModel)` and receive `ConnectionStrings__chatModel = Endpoint=…;Key=…;Model=…`. `IsChatModelEnabled` gates it: on when a key is configured (`GEMINI_API_KEY` or `OPENAI_API_KEY` in the environment, or `Parameters:openai-openai-apikey` in user-secrets) or when publishing; off otherwise, so a checkout without a key still runs.
- **Services** call `AddAIServices()`: `Aspire.OpenAI`'s `AddOpenAIClient("chatModel").AddChatClient()` when the connection string exists, a scripted `FakeChatClient` when `AI:UseFake` is set (the AppHost sets it under test), nothing at all otherwise.
- **Feature classes** take the chat client as an *optional* dependency and expose `IsEnabled` (eShop's `CatalogAI` idiom). Endpoints answer `503` when it is off; the admin app hides the buttons for the session on the first `503`.
- **AppHost unit tests** (`tests/Chillax.AppHost.UnitTests`, `IsAspireProjectResource="false"`) pin the gate and the resources.

### D3 — Ownership stays where it is; the AI only proposes

Catalog owns `POST /api/catalog/assist/localize`; Inventory owns `POST /api/inventory/purchases/scan`. Neither writes: localize returns the filled text for the form, scan returns a proposal for the review sheet, and the user creates items and receives the purchase through the endpoints that already exist. No service calls another; the review sheet joins Finance's suppliers itself. One model round-trip per action (plus one repair round if the JSON does not parse).

### D4 — Voice and numbers are checked, not trusted

- **Localize**: the source language is copied back from the request, never from the model; the target is cleaned and capped; price wording is stripped and flagged; Arabic with no Arabic letters is flagged; a category is accepted only from the list and only when asked for. `Filled` names what the assistant filled so the form overwrites nothing the user typed.
- **Scan**: ids are checked against the shelf; quantities are recomputed from packs × pack size in the item's base unit; money is reconciled from whichever two numbers agree, the printed total winning over qty × cost; every doubt becomes a `line N: …` warning; unmatched lines carry look-alike suggestions (`StockItemMatcher`, Arabic-aware) and a proposed new item with an allow-listed unit.

### D5 — The free tier is shared, so the services throttle first

`ChillaxAIRateLimiting`: a per-service ceiling (`AI:RequestsPerMinute`, 4) and a per-user one (`AI:PerUserRequestsPerMinute`, 3), `429` + `Retry-After` when hit; the provider's own `429` is passed through as `429`, never retried. Photos are downscaled in the browser (longest side 1600 px, JPEG) and capped at 5 MB on the server, with the bytes deciding the type.

## 3. Shape

```
src/Chillax.AI/                    shared: options, AddAIServices, agent factory, fake, image checks, problems, rate limiting
src/Catalog.API/Assist/            LocalizeContracts, MenuLocalizer (agent), LocalizerPostProcessor (pure), MenuLocalizerFake
src/Catalog.API/Apis/CatalogAssistApi.cs
src/Inventory.API/Application/Assist/
                                   ReceiptContracts, ReceiptScanner (vision agent), ReceiptProposalValidator (pure),
                                   StockItemMatcher (pure), ReceiptScannerFake
src/admin_web/src/features/assist/ errors (429/503/400 → messages, unavailable flag), use-localize-assist, use-name-assist
src/admin_web/src/components/localized-input.tsx   sparkle button, tinted "suggested" side, controlled language
src/admin_web/src/features/inventory/{lines,receipt-scan,use-receipt-scan}.ts
src/admin_web/src/features/inventory/components/{line-amounts,receipt-review-sheet}.tsx
```

The fake answers are deterministic (localize: `"{en} (تجريبي)"` / `"{ar} (fake)"`, first category when asked; scan: the first two shelf items matched, one unmatched "مياه معدنية 1.5 لتر" proposing a new item) so `tests/Chillax.E2E/Scenarios/AssistantScenario.cs` can drive the whole path — localize both ways, scan, create the proposed item, receive the purchase, see `PurchaseReceived` and the supplier invoice — without a key.

## 4. Running it

- Local: set `GEMINI_API_KEY` in the environment (or `dotnet user-secrets set "Parameters:openai-openai-apikey" "AIza…" --project src/Chillax.AppHost`), then `aspire run`; the dashboard shows `openai` and `chatModel`. Provider and model: `AI` section of `src/Chillax.AppHost/appsettings.json`. The key is never committed.
- Deploy: `aspire publish` emits `OPENAI_OPENAI_APIKEY=` in `.env`; `deploy.yml` fills it from the `GEMINI_API_KEY` repository secret. An empty secret trips the empty-placeholder guard on purpose.
- If a provider rejects the JSON schema, `AI:StructuredOutput=JsonObject` puts the schema in the prompt and enforces only "answer in JSON".
- Free-tier prompts may be used by Google to improve its models: do not scan anything that must not leave the building.

## 5. Not done / later

- Live checks against the provider: `MenuLocalizerLiveTest` and `ReceiptScannerLiveTest` run only when `GEMINI_API_KEY` is set (inconclusive otherwise) and print what the model answered; they are the place to look when a provider or model changes.
- The mobile admin app has none of this; the endpoints are there if it wants them.
- A receipt that lists an item the shelf knows under a different name still needs the user to pick it; the look-alikes are offered first, that is all.
