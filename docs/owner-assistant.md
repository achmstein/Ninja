# The owner's assistant (MCP)

**What it is.** A remote Model Context Protocol server, `src/Assistant.API`, at `https://api.<tenant>/mcp`. An owner adds it as a connector in Claude.ai, Claude Desktop, ChatGPT or Claude Code, signs in with their Ninja account, and asks about sales, profit, expenses, stock, staff and the drawer, or has an expense recorded, an item marked sold out, or online ordering paused, each after a preview they confirm. The chat model is the owner's own (their Claude or ChatGPT subscription); Ninja runs no model for this.

**Status:** built 2026-09-23 on MCP 2026-07-28 with the C# SDK 2.2.

## How it fits

```
Claude / ChatGPT ──OAuth (PKCE; registers itself, or ninja-mcp)──▶ Keycloak  auth.<domain>/realms/<slug>
        │  Bearer: aud = https://api.<t>/mcp + assistant-api, scope mcp
        ▼
api.<t>/mcp ──BFF──▶ assistant-api ──RFC 8693 token exchange──▶ Keycloak
                          │  its own token for the same owner (role, branches claims)
                          ▼  http://sales-api, http://finance-api, … by Aspire name
```

- One more service in the stack: no database, no bus, no chat model. It reaches the others by their service-discovery names, never through the BFF.
- The BFF (and every stamped gateway) routes `/mcp`, `/mcp/{*any}` and `/.well-known/oauth-protected-resource[/…]` to it.
- Every request needs a token minted for this endpoint (`Owner` role, audience checked). A token for the admin panel or the till is refused; a cashier with an assistant token gets 403.
- The inbound token never leaves the service. Each tool call exchanges it (cached until shortly before expiry) for the confidential client `assistant-api`'s own token, which is what Sales, Finance and the rest see.
- Writes are two calls: `confirm=false` returns a preview and writes nothing; `confirm=true` with the same `requestId` acts, once (the request id becomes the services' `x-requestid` idempotency key), and logs `MCP write …` with the user and the arguments.

## Keycloak

Both realm files (`src/Ninja.AppHost/KeycloakConfiguration/realms/chillax-realm.json` and `src/Control.API/Templates/tenant-realm.json`) carry:

| Piece | Purpose |
|---|---|
| client scope `mcp` | an audience mapper: `included.custom.audience` = `<api host>/mcp`, `included.client.audience` = `assistant-api`; consent text on screen |
| `defaultDefaultClientScopes` / `defaultOptionalClientScopes` | what a client that registers itself gets: openid, profile, email, roles, branches, mcp (+ offline_access) |
| `scopeMappings` | the `mcp` scope grants Owner, Admin, Cashier, so a self-registered client (full scope off) still sees the owner's roles |
| client `ninja-mcp` | public, PKCE, consent; redirect URIs for claude.ai and Claude Code's fixed port 8765; password grants only in the dev realm |
| client `assistant-api` | confidential, no browser flow, `standard.token.exchange.enabled` |
| anonymous registration policies | Trusted Hosts (chatgpt.com, openai.com, claude.ai, anthropic.com; the requester's own host is not checked), Consent Required, Full Scope Disabled, Max Clients 50, Allowed Client Scopes (defaults + mcp, offline_access) |

Keycloak 26.4 ignores the OAuth `resource` parameter and has no Client ID Metadata Documents yet (26.7 nightlies behind `--features=cimd`), which is why the audience rides on a scope and why registration is dynamic. When a stable Keycloak ships CIMD, it can replace dynamic registration without touching the server.

**Realms are imported once.** A realm that exists is never re-read, so:

- Stamped tenants: the provisioner's realm step calls `IKeycloakAdmin.EnsureAssistantClientsAsync` when the realm is already there (a re-provision, secure or upgrade), which adds everything above from the template. The credentials step gives a tenant without one an `AssistantSecret`.
- The single Chillax stack: `deploy/keycloak-assistant.py` does the same through the admin REST API; the deploy runs it after the token-exchange step. By hand:

  ```
  KEYCLOAK_PASSWORD=… python3 deploy/keycloak-assistant.py \
    --keycloak https://auth.chillax.site --realm chillax \
    --realm-file src/Ninja.AppHost/KeycloakConfiguration/realms/chillax-realm.json \
    --api-url https://api.chillax.site --secret "$ASSISTANT_SECRET"
  ```

## Configuration

| Setting | Dev (AppHost) | Chillax deploy | Stamped tenant |
|---|---|---|---|
| `Assistant:PublicUrl` | `http://localhost:5000/mcp` (the BFF) | `https://api.chillax.site/mcp` | `https://api.<slug>.<domain>/mcp` |
| `Assistant:Issuer` | `http://localhost:8080/realms/chillax` | `https://auth.chillax.site/realms/chillax` | `https://auth.<domain>/realms/<slug>` |
| `Assistant:TokenExchange:ClientSecret` | `assistant-api-secret` (parameter `assistant-secret`) | `ASSISTANT_SECRET` in `.env` (repository secret) | `ASSISTANT_SECRET` in the stack's `.env` |
| `services__*-api__http__0` | from `WithReference` | Aspire's compose output | `Templates.Compose` per stamped service |

`Assistant:PublicUrl` must be the URL exactly as the owner types it into the connector: the protected-resource document's `resource` and the token audience are compared byte for byte.

## Tools

Read: `get_business_overview` (call first), `get_sales_summary`, `get_sales_breakdown` (hour, weekday, cashier, item), `get_daily_sales_trend`, `get_refunds`, `get_shifts`, `get_profit`, `get_profit_trend`, `get_expenses`, `get_supplier_balances`, `get_stock_levels`, `get_inventory_usage`, `get_staff`, `get_attendance`.

Write (preview, then confirm): `record_expense`, `set_item_availability`, `pause_online_ordering`.

Periods are business days in the tenant's zone, each branch from its own `dayStartTime`; `today` at 02:00 in a café whose day starts at 17:00 is still yesterday. Leave `branch` out for every active branch, with a total and a line per branch. Answers are JSON, Arabic kept readable, lists trimmed to `top`, and a reply over 60 000 characters is refused with a hint rather than cut.

## Connecting

- **Claude.ai / Desktop:** Settings → Connectors → Add custom connector → `https://api.<tenant>/mcp`. Leave the client id blank (Claude registers itself) or put `ninja-mcp` under advanced settings. Sign in as the owner, accept the consent screen.
- **ChatGPT:** Settings → Connectors → Create (developer mode) → the same URL, authentication OAuth. ChatGPT registers itself; the trusted-hosts policy admits its callbacks.
- **Claude Code:** `claude mcp add --transport http --client-id ninja-mcp --callback-port 8765 ninja https://api.<tenant>/mcp`, then `/mcp` → Authenticate. Locally the same against `http://localhost:5000/mcp` (admin / Admin123$).

The chat apps connect from Anthropic's and OpenAI's own networks, so the API host and the auth host must be reachable from the internet; a laptop needs a public tunnel.

## Checks

- `tests/Assistant.UnitTests`: period arithmetic, branch matching, the downstream client's headers and error sentences, the token exchange form and cache, the sales tools' aggregation, the write tools' preview/confirm contract.
- `tests/Ninja.E2E` (`McpAuthGuardTests`, `McpAssistantScenario`): the protected-resource document through the BFF, the 401 challenge, a wrong-audience token refused, a cashier forbidden, then the official client listing tools, reading today's sales and recording an expense that Finance shows once.
- `tests/Control.UnitTests`: the stamp's compose, routes and env carry the service; the template yields the realm parts the backfill needs.
- Deployed: `curl https://api.chillax.site/.well-known/oauth-protected-resource/mcp`, `curl https://api.chillax.site/health/assistant`, then a connector in Claude.ai and one in ChatGPT.
