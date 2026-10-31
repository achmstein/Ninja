# Multi-server plan: one control plane, many cells

Status: written 2026-10-31. Line numbers are as of that date.

- **Phase 1 done (2026-11-01).** Every docker call goes through `Platform/Nodes` (`INodes`, `INodeClient`, `LocalNodeClient`; `SingleNode` until a second node joins). Stack addresses come from `NodeEndpoints`, the edge from `IEdgeRouter`, and seed files from `PlatformOptions.ControlRoot`. `tests/Control.UnitTests/GoldenCommandsTests.cs` holds the line: the box hears what it heard before, and stacks are stamped word for word.
- **Phase 2 done (2026-11-01).** Covers `Model/Node.cs` and the `AddNodes` migration (it inserts node 1 itself and moves the identity past it), `NodeDirectory` (the record, read at start and after each change), `NodeLimits`, `SpreadPlacement` behind `Placement`, `/platform/nodes` (list, PATCH), and the control app's Nodes tab. The tenants table gets no node column until a second node exists.
- **Phase 3 done (2026-11-01).** `tenant_api` and the API host take the tenant's slug; a Caddy `map` (snippet `tenant_upstream`) turns it into `{slug}-gateway:5000`, or the node's ingress when `tenant-routes.caddy` lists it. `CaddyEdgeRouter` writes that file with the custom domains: one validate, one reload, both files put back on refusal. Both Caddyfiles validate in `caddy:2-alpine`, including an empty route file, and the routing was checked live in a container (listed slug → its ingress, others → their gateway).
- **Phase 4 done (2026-11-01).** What runs on a node is `src/Ninja.Control.NodeRuntime`, with `NodeSettings` in place of the platform options. `src/Ninja.NodeAgent` is the agent: a `/v1` API, names checked, a `ComposePolicy`, and mTLS that pins the control plane's certificate. `AgentNodeClient` and `AgentConnections` pin the agent's certificate. Nodes are registered and pinged through the API, and every agent node's capacity is read on the timer. The edge names the tenant to a cell in `X-Ninja-Tenant` (a business's own domain keeps its host), and the internal edge listens on `:8090` at the box's WireGuard address. `deploy/cell` holds the cell, `setup-node.yml` sets a node up, and deploy-platform ships the client certificate.
  - Checked: contract tests (each part through the agent runs the commands it runs locally); a live mTLS check (pinned certificate 200, none or a stranger's refused at the handshake); live edge → cell → gateway routing; every Caddyfile and compose file validated; both images built.
  - **Departures:** the certificates are pinned self-signed ones made by setup-node, not a CA with join tokens, which makes mutual pinning a smaller moving part. The tenant images are still arm64-only, so a cell must be arm64 until they are built for amd64 too.
- **Phase 5 done (2026-11-01).**
  - The watchdog reconciles each node's tenants against that node's own stacks, and pings every agent node: three misses make it Unreachable, with one mail to ops; when it answers again it comes back Cordoned.
  - The update check reads the running images on every reachable node.
  - A lane runs one job per node at a time (`Platform:LaneConcurrency`, default 1 = as before). Claims are serialised in the process.
  - Restores and bring-backs go through placement.
  - **Departure:** backups stay with the control plane. A cell's dumps and volumes stream through its agent into the control box's backup folder, and restores stream back, so any backup restores onto any node with no catalogue table and no presigned uploads from agents. The cost is the control box's disk and bandwidth; revisit with offsite-first storage when cells are many.
- **Departure from section 3:** a node is composed of parts (`Stacks`, `Data`, `Databases`, `Broker`, `Capacity`, `Images`, `RouteTo`) rather than one interface inheriting three. The agent client can implement each part separately.

## Findings that shape the design

1. **Restore and bring-back cannot move a tenant.** Both create a new Keycloak realm, so every customer would have to sign up again (`ControlApi.cs:257-263`, `ControlApi.Backups.cs:85,126`). Destroy deletes the realm (`Provisioner.cs:529-535`). A move must keep the slug and the realm, so it is its own procedure. It reuses the restore building blocks (`RestoreDatabasesAsync`, `RestoreUploadsAsync`).
2. **Uploads live in docker named volumes**, not the tenant folder (`TenantNaming.cs:123-131`). Moving a tenant means copying volumes.
3. **There is one Stamp worker for the whole fleet** (`Jobs.cs:29`, `:313-314`). Several nodes need one job at a time per node, not one in total.
4. **The update check uses the control plane's own CPU architecture** (`Updates.cs:265-270`). A mixed arm64/amd64 fleet needs `Node.Architecture`.

## 1. Where the code assumes one server

- **Running commands:** `Shell.cs:43-50` (`IShell` runs locally); `Extensions.cs:147-171` registers one shell and one each of `IDatabaseAdmin`, `IBrokerAdmin`, `ITenantStack`, `IHostCapacity` and `IStackProxy`.
  - `Provisioner.cs`: compose up `:292,333,922,954`, down `:517`, stop `:772`, start `:782`, `UpArgs` `:986-989`, Caddy `:1006,1013`.
  - `TenantOps.cs:71,82`; `Infra.cs:332-380` (rabbitmqctl via docker exec).
  - `Backups.cs`: pg_dump `:431-433`, pg_restore `:309-312`, alpine volume containers `:67-69,83-85,370-372`.
  - `HostCapacity.cs:57,72,73`; `Updates.cs:194,198,218`.
  - `Jobs.cs:77-96`: claiming has no lock and no node.
- **Files on disk:**
  - Tenant folder: `TenantsRoot`, `Provisioner.cs:36`.
  - Seed images and menu, which are control-plane state mixed into the node folder: `Provisioner.cs:39-46`, `ControlApi.Brand.cs:142-207`.
  - Compose and `.env`: `:356-367`. Markers: `:409-443`.
  - "Is it stamped" is a `Directory.Exists` check: `:330,497,516-519,781-782,919,951`.
  - Backup layout, free-space floor, archive via `Directory.Move`, prune and listing: `Backups.cs:47-260,399-411`.
  - `deploy/platform/docker-compose.yml:168-173`: same host path inside and out, plus the docker socket.
- **Networking and service discovery:**
  - `PlatformOptions.cs:42-83,168`: `aspire` network and container-name hosts. `Talabat.cs:34` relay URL.
  - `Templates.cs:494,495,518,560-563,593-594,635-640,721,732`.
  - `StackAccess.cs:94` reaches stacks at `http://{slug}-gateway:5000`.
  - `Infra.cs:149-158`: one superuser connection.
- **Routing, TLS and DNS:**
  - `Caddyfile:88-98,234-292`: upstream is `{labels.N}-gateway`.
  - `README.md:67-70`: wildcard DNS points at "this box".
  - On-demand TLS ask (`ControlApi.cs:462-474`) is fine as it is.
- **Capacity:**
  - `HostCapacity.cs` reads one `/proc`, one drive, one `Latest`.
  - `CapacityMath.cs:110`: `PlatformConnections = 40`.
  - Global footprint and reserve options.
  - Callers: `ControlApi.cs:20,62-94,172-173,245-246,274-275,306-307`, `ControlApi.Backups.cs:82-83`, `Backups.cs:620`.
- **Backups:**
  - `Backups.cs:53-105`; nightly run `:533-550`; drill `:610-660`.
  - `ControlApi.Backups.cs:26-67` reads the local disk.
  - Backups during restore, destroy and upgrade: `Provisioner.cs:65-111,495-511,738-757`.
- **Upgrades:**
  - `--pull` runs on the local daemon.
  - `deploy-platform.yml:372`: registry login only on the platform box.
  - `Updates.cs:161-226,265-270`.
- **Health:** `Health.cs:42-55` (one drive), `:84-102,141-183` (reconciler against one snapshot).
- **Secrets:** `.env` on local disk; one Postgres and Rabbit password for the fleet; `PGPASSWORD` on a local `docker exec`.
- **Custom domains:** `PlatformOptions.cs:104-106`, `Provisioner.cs:992-1016`, `Templates.cs:688`.
- **Firebase:** a bind mount of a host path (`Templates.cs:560-563`), written only on the platform box (`deploy-platform.yml:172-173,344-353`).
- **control_web:**
  - `capacity-strip.tsx`, `capacity-table.tsx`, `platform/index.tsx`
  - `new-tenant.tsx` (one `noRoom` flag)
  - `tabs/health.tsx`, `queue-table.tsx`
- **Workflows:** `deploy-platform.yml` (one SSH host), `reset-platform.yml:41-67`, `AppHost/Program.cs:273-279`.

## 2. Target architecture

One control plane plus N self-contained **cells**, joined by a private WireGuard network. A small **node agent** with mutual TLS runs each cell. The central Caddy stays the only public entry point.

```
             Internet (wildcard DNS unchanged → control box)
                              │
   ┌──────── control box (today's box = node 1) ─────────────────────┐
   │ Caddy (public edge, on-demand TLS, tenant-routes.caddy map)     │
   │ control-api (+ AI gateway, Talabat relay)  Keycloak (all realms)│
   │ platform Postgres (controldb, keycloak) + node-1 cell as today  │
   │ internal edge on wg0: /realms/*, /admin/realms/*, /ai/v1/*, relay│
   └──────────────┬──────────────────────────────────────────────────┘
                  │ wg0 (10.66.0.0/24), only UDP 51820 public
   ┌──────────────┴──────────┐   ┌─────────────────────────┐
   │ node 2 (cell)           │…  │ node N (cell)           │
   │ ninja-agent (mTLS :7443)│   │ same                    │
   │ cell-ingress Caddy :8088│   │                         │
   │ postgres, eventbus      │   │                         │
   │ ninja-{slug} stacks     │   │                         │
   └─────────────────────────┘   └─────────────────────────┘
```

- **Postgres and RabbitMQ per cell, not shared.**
  - A shared Postgres caps at about 8 stacks (400 connections, 44 per stack). It would also put every tenant's I/O on one disk, add latency on every query, and take every server down when it fails.
  - Per cell, the container names inside the cell stay `postgres` and `eventbus`, so most of the templates do not change.
- **Keycloak stays central.** The hub realm, the one `auth.{domain}` host, impersonation and social sign-in all assume one Keycloak. Cells reach it over wg0 (`KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true` is already set). To scale it later, run an HA pair, not one Keycloak per cell.
- **The AI gateway and Talabat relay stay central.** Both are keyed by slug.
- **A node agent rather than Docker over SSH.**
  - Docker over SSH or TCP gives the control plane root on every node through a general-purpose channel, returns errors as plain text, and handles file writes and streaming badly.
  - The agent (`src/Ninja.NodeAgent`) is a narrow, typed, versioned `/v1` API that runs **the same `LocalNode*` classes node 1 runs in-process**, so the code is tested once.
  - Postgres and Rabbit admin passwords never leave the node.
- **Private network:** plain WireGuard, which is in the kernel and needs no vendor. Tailscale or Headscale, or a provider's private network, would also work; keep mTLS either way.
- **Routing: one central edge for now.**
  - Caddy reads a generated `tenant-routes.caddy` map (slug → cell ingress) and reloads with validation, exactly as `custom-domains.caddy` already works.
  - Node 1 is the map's default (`{slug}-gateway:5000`), so nothing changes for today's tenants.
  - Not a DNS record per tenant yet: TTLs make moves slow, every node would need its own TLS, and custom domains would need CNAME changes.
  - At hundreds of tenants: two edges behind a floating IP with shared certificate storage.
- **PgBouncer: not yet.** Pools start at zero connections. Measure `pg_stat_activity` on the live box first. Add PgBouncer per cell (transaction mode) when nodes reach 64 GB or more.

**What this means at each size:**
- Today (2 demos): Phases 1–3 ship with no visible change.
- Tens of tenants: 2–4 cells.
- Hundreds of tenants: more than 10 cells at about 25 stacks each, a control box that hosts no tenants, HA edge and Keycloak, PgBouncer and WAL archiving.

## 3. Code design

### Entities (migration `AddNodes`)

```csharp
public enum NodeKind { Local = 0, Agent = 1 }
public enum NodeStatus { Active = 0, Cordoned = 1, Draining = 2, Unreachable = 3, Retired = 4 }

public class Node
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public NodeKind Kind { get; set; }
    public NodeStatus Status { get; set; } = NodeStatus.Active;
    public string? AgentUrl { get; set; }          // null for Local
    public string? IngressUrl { get; set; }        // null = container names
    public string? CertThumbprint { get; set; }
    public string Architecture { get; set; } = "amd64";
    public string[] Labels { get; set; } = [];     // "demo", "customer"
    public int? ReserveMb { get; set; }            // null = PlatformOptions value
    public int? StackFootprintMb { get; set; }
    public int? PostgresMaxConnections { get; set; }
    public int? PlatformConnections { get; set; }
    public int? MaxStacks { get; set; }
    public string? KeycloakInternalUrl { get; set; }
    public string? AiGatewayUrl { get; set; }
    public string? TalabatRelayUrl { get; set; }
    public string? AgentVersion { get; set; }
    public DateTimeOffset? LastSeenAt { get; set; }
    public string? LastError { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
```

- `Tenant`: add `NodeId` (default 1) and `MovingToNodeId`. `TenantStatus` gains `Moving`. `Job` gains `NodeId`.
- Later (Phase 5): a `TenantBackup` catalogue replaces the directory scan. The manifests stay.
- The migration seeds node 1 (Local, Active, every override null) and backfills `NodeId = 1`. No config migration.

### Per-node execution (replaces direct `IShell` use)

```csharp
public sealed record StackFiles(string Compose, string Env);

public interface IStackRuntime
{
    Task WriteStackAsync(string slug, StackFiles files, CancellationToken ct);
    Task<bool> IsStampedAsync(string slug, CancellationToken ct);
    Task<string> UpAsync(string slug, bool pull, CancellationToken ct);
    Task<string> StopAsync(string slug, CancellationToken ct);
    Task<string> DownAsync(string slug, bool removeVolumes, bool deleteFiles, CancellationToken ct);
    Task<IReadOnlyList<ContainerInfo>> PsAsync(string slug, CancellationToken ct);
    Task<string> LogsAsync(string slug, string? container, int tail, CancellationToken ct);
    Task<string?> ReadMarkerAsync(string slug, string name, CancellationToken ct);
    Task WriteMarkerAsync(string slug, string name, string content, CancellationToken ct);
}

public interface INodeData
{
    IDatabaseAdmin Databases { get; }
    IBrokerAdmin Broker { get; }
    Task DumpDatabaseAsync(string database, Stream output, CancellationToken ct);
    Task RestoreDatabaseAsync(string database, string role, Stream input, CancellationToken ct);
    Task<bool> ExportVolumeAsync(string volume, Stream output, CancellationToken ct);
    Task ImportVolumeAsync(string volume, Stream input, CancellationToken ct);
    Task<IReadOnlyDictionary<string, long>> QueueDepthsAsync(string vhost, CancellationToken ct);
}

public interface INodeProbe
{
    Task<CapacitySnapshot> ProbeAsync(CancellationToken ct);
    Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>> RunningImagesAsync(CancellationToken ct);
    Task<IReadOnlyDictionary<string, string>> LocalImagesAsync(CancellationToken ct);
    Task<NodeHealth> PingAsync(CancellationToken ct);
}

public interface INodeClient : IStackRuntime, INodeData, INodeProbe { NodeRef Node { get; } }

public interface INodes
{
    INodeClient For(int nodeId);
    INodeClient For(Tenant tenant);
    Task<IReadOnlyList<Node>> ListAsync(CancellationToken ct);
}
```

- `LocalNodeClient` holds today's exact command lines, moved out of `Provisioner`, `TenantOps`, `BackupService`, `ProcHostCapacity`, `UpdateCache` and `RabbitCtlBrokerAdmin`.
- `AgentNodeClient` calls the agent over mTLS. Dumps and volumes stream as octet-stream.
- `DryRunNodes` provides N local clients over `RecordingShell`, configured with `Platform:DryRunNodes`.

### Other pieces

- **`NodeEndpoints`** (network, Postgres and Rabbit hosts, and the Keycloak, AI gateway and relay URLs as each node sees them) is passed into `Templates.Compose`. For node 1 the output is identical, which a golden test checks.
- **`HttpStackProxy`:** `IngressUrl` null → `http://{slug}-gateway:5000`; otherwise `{IngressUrl}{path}` with `Host: api.{slug}.{domain}`.
- **`IEdgeRouter.ApplyAsync`** renders custom domains plus `tenant-routes.caddy`, validates, reloads, and restores the previous file if Caddy refuses it. `Provisioner.WriteEdgeAsync` moves into it.
- **`IPlacementPolicy.Place(request, nodes)`** is pure. The default `SpreadPlacement`: only Active nodes; prefer label matches; require room unless forced; most room first, then fewest stacks, then lowest id.
- **Capacity per node:** `NodeCapacityCache`, a dictionary probed in parallel, with per-node overrides. Callers switch from `HasRoom` to placement, and the 409 response gives the reason for each node.
- **Jobs:** each job carries `NodeId`, and a claim takes at most one running job per lane per node. Lane pools default to concurrency 1, which is today's behaviour. Use `FOR UPDATE SKIP LOCKED` if the control plane ever runs twice. `Move` gets its own lane.
- **Backups:** dumps run on the node; the control plane orchestrates and keeps the catalogue. Offsite copies go up through presigned S3 URLs, so agents never hold bucket keys.
- **Control-plane files** (seed images, seed menu) move to `Platform:ControlRoot`, which defaults to `TenantsRoot`.

## 4. Tenant lifecycle

- **Create:** placement chooses the node (or it is pinned), then the existing steps run against `nodes.For(tenant)`.
- **Upgrade:** pull and backup run on the node. The update cache combines every node and uses each node's architecture. One stack at a time per node, nodes in parallel, keeping the canary rule.
- **Stop, start, backup, destroy:** run on the tenant's node. Destroy also sends the last backup offsite.
- **Move (same slug, same realm):**
  1. Checks. Set `MovingToNodeId`; the status becomes `Moving`.
  2. Prepare the target: same DB and broker passwords, empty databases, vhost, stack files, pull. Take a safety backup offsite.
  3. Stop the source gateway. Wait until the Rabbit queues are empty (2-minute timeout), then stop the source. **Downtime starts.**
  4. Stream the 11 database dumps and the 2 volumes from source to target. Check every exit code.
  5. Start the target and wait until it is healthy through its ingress.
  6. Flip `NodeId` in one transaction, apply the edge, smoke-test through the public URL, push entitlements. **Downtime ends.**
  7. Keep the source in quarantine for 7 days, then a `cleanup-moved` job removes it.
  - Expected downtime: 2–5 minutes.
  - Rollback before step 6 restores the source with no data loss. A failure in step 6 flips back and is audited.
  - Every step is idempotent and survives a restart.
- **Cordon, Drain, Retire:** Drain moves the node's tenants one by one. Retire requires an empty node with no backups that exist only there.
- **Node failure:**
  - After 3 missed pings the node is marked `Unreachable` and ops are mailed. **Nothing moves automatically.**
  - An operator-run **Evacuate** restores each tenant from its newest offsite backup, keeping slug and realm.
  - Fencing: the reconciler stops a stack on a node that is no longer its home, and the AI gateway and relay check the caller's source IP.

## 5. Security

- WireGuard between nodes. A cell exposes only UDP 51820 and SSH publicly; Postgres and Rabbit are never published.
- Agent mTLS from a private CA, with its key encrypted by `PLATFORM_ENCRYPTION_KEY`.
  - Enrolment uses a one-time join token (15 minutes, stored hashed).
  - Certificates last 90 days, renew automatically, and their thumbprints are pinned.
- No arbitrary exec on the agent. Slugs are validated.
- Compose policy checks every stack before it starts: images only from the registry, only the Firebase bind mount, no privileged mode, no `cap_add`, no host network.
- Nodes reach only the allowed internal paths: `/realms/*`, `/admin/realms/{realm}/*`, `/ai/v1/*` and the relay. Never `controldb`, the master realm or the control API.
- Node secrets live only on the node. Tenant `.env` files are pushed over mTLS and written 0600. S3 access uses presigned URLs (1 hour).

## 6. Phases (each ships on its own)

1. **Pure refactor.** Add `INodeClient`, `LocalNodeClient`, a single-node `INodes`, `NodeEndpoints`, `IEdgeRouter` and the control-root split.
   - Tests: a golden test proves the recorded docker commands are byte-identical before and after, for provision, upgrade with rollback, stop/start, backup, restore, destroy and edge; a snapshot of the compose output; existing tests unchanged.
2. **Node model and per-node capacity, still one node.** Migration, nodes API, a Nodes tab, and a node column on tenants and the queue.
3. **Edge route map,** with every tenant on the default upstream.
4. **Node agent and the first cell,** enrolled as Cordoned. Includes `deploy/cell/docker-compose.yml` and `setup-node.yml`.
   - Tests: a contract test suite runs against both the local client and an in-process agent; mTLS and compose-policy tests.
   - Live check: run the restore drill pinned to node 2.
5. **Placement, per-node lanes, the backup catalogue and offsite.** Offsite is required before any Agent node.
6. **Move, drain and retire,** with failure-injection tests at every step.
7. **Failure handling and scale:** Evacuate, fencing, WAL archiving, PgBouncer, HA edge and Keycloak.

## 7. Risks and open questions

**Risks:**
- The control box is a single point of failure (as it is today).
- Recovery point is one day (nightly dumps). Add WAL archiving before paying customers go on remote cells.
- A move depends on queues draining; a poison message can stall it.
- Stacks restart themselves after a node reboots, so fencing is required before Evacuate is used.
- Mixed CPU architectures break the update check until `Node.Architecture` is used.
- Job claims are only safe within one process.
- The agent and control plane can drift in version (versioned `/v1`, version reported in ping).
- All traffic, menu images included, goes through the edge, which costs egress.
- The internal edge must never expose the master realm or the control API to nodes.

**Questions for the owner:**
1. Will all nodes be at one provider and region (WireGuard versus a private network)?
2. Is a central edge acceptable for now?
3. Is 2–5 minutes of downtime per move acceptable? Should customers see a "maintenance" message rather than "paused"?
4. Is offsite S3 configured on the live box?
5. What recovery point is needed for paying customers?
6. Should node 1 become control-plane only once node 2 exists?
7. Should demos go on cheaper, separate nodes?
8. Long term, a stack per tenant costs about 2 GB and 13 containers per business. Shared, tenant-aware services for small plans would be the biggest scaling lever.
9. Plain WireGuard or Tailscale/Headscale?
10. Confirm: no automatic failover, only an operator-run Evacuate.
