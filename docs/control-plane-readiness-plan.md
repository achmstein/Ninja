# Control plane: production readiness + paid modules — the plan, as built

> Saved from the planning session of 2026-09-20 so the work can continue from
> any machine. The plan below is the one that was approved and implemented;
> the block right here is where things stand. The map of what landed is in
> `docs/control-plane-plan.md` (Batch 4), the operator's view in
> `deploy/platform/README.md`.

## Where it stands (2026-09-20, end of the session)

**All six phases plus paid modules are implemented and verified** on the
laptop platform (`deploy/platform/local`, compose project `ninja-local`):
tenant secured onto its own role/user and capped, platform + tenant backups
in the MinIO bucket `ninja-backups`, welcome / payment / suspended mails in
Mailpit (`http://localhost:8025`), a Starter customer answered 402 on
inventory and finance with the owner's switches clamped, add-on flow
(only the gateway recreated), payment, suspend → `{"code":"paused"}` 503,
start refused 409, resume via payment, destroy with archived backup +
offsite copy + role/user dropped, an upgrade to `v2` and an upgrade to a
missing tag that rolled back by itself.

Green: `dotnet build` (0 errors), `tests/Control.UnitTests` 88,
`tests/Branch.UnitTests` 13, `tests/Ninja.Contracts.Tests` 8,
`tests/Ninja.AppHost.UnitTests` 6; `npm run build` for control_web,
admin_web, client_web, kds_web; eslint clean on every touched file (the one
error in `client_web/src/lib/use-keyboard-inset.ts` is pre-existing).

**Nothing is committed.** The working tree also carries the earlier
uncommitted work of the same day (Keycloak theme `chillax` → `ninja`, café
name on the staff sign-in/header, workflow and compose edits) and the
untracked `tenants/` folder. Suggested PR slices are at the end of the plan.

### To continue

1. Commit (see the slices) and push; pull on the other machine.
2. Production rollout order: Branch.API image first or together (its
   `*Entitled` default to true, so nothing changes until the control plane
   pushes); Control migrations run at startup (`TenantCredentials`,
   `TenantMail`, `Subscription`, `TenantUpgradeRollback`; Branch:
   `TenantEntitlements`). New `.env` keys on the box: `OFFSITE_*`,
   `MAIL_*`, optional `RESTORE_DRILL_ENABLED` (see `.env.example`); the
   workflow `deploy-platform.yml` reads them from optional secrets
   `PLATFORM_OFFSITE_*` / `PLATFORM_MAIL_*`.
3. After the first deploy: `POST /api/control/platform/mail/realms` once
   (gives existing realms their SMTP), and **Secure now** (or a fleet
   upgrade) on every stack stamped before this so it leaves the shared
   credentials and gets its caps.
4. Optional follow-ups, none started: payment-provider webhook onto
   `SubscriptionService.RecordPaymentAsync`; client-side encryption of the
   offsite archives; the E2E suite against the canary before the rest of a
   fleet upgrade; Keycloak admin console restricted by IP.

### Local box state (this laptop only)

- `mcdonald-s`: Running on `imageTag v2` (the twelve `:local` images tagged
  `:v2`), `previousImageTag` cleared, `lastError` still says "upgrade to
  nope rolled back" (informational). `cove` was destroyed; its archive is
  under `/opt/ninja/tenants/_archive/cove/`.
- The temporary `directAccessGrantsEnabled` on the local `ninja` realm's
  `control-web` client was reverted.
- Control image rebuilt after the last code change (auto-rollback no longer
  keeps the failed tag as the rollback target).

### Conventions that matter when continuing

- After any Control.API change: `dotnet build src/Control.API` (regenerates
  `Control.API.json`) → `npm run generate:api` in `src/control_web`;
  Branch.API likewise for `src/admin_web`.
- Migrations: `dotnet ef migrations add <Name> --project src/Control.API`.
- `TenantStatus` is index-aligned with control_web's `TENANT_STATUSES`:
  append only (`Upgrading = 7`, `Suspended = 8` are taken).
- Files are CRLF; on Windows run `.ps1` scripts from PowerShell with an
  absolute `Set-Location`; `export MSYS_NO_PATHCONV=1` before docker
  commands from git-bash.

---

# Control plane: production readiness + paid modules

## Context

The control plane (`src/Control.API`, `src/control_web`) can stamp, run, back up, brand and destroy a tenant, but several things a paid service needs are missing or unsafe — all verified in code:

- Every stamped stack connects to Postgres as the shared superuser and to RabbitMQ as the shared `guest` user (`Templates.Compose`, `Infra.cs`): one compromised café stack can read every other café's data. The tenant's `.env` even holds the platform superuser password.
- Stamped compose files set no memory/CPU/pids/log limits; one runaway service can take the box — and every tenant on it — down.
- Backups are local to the box (`{TenantsRoot}/{slug}/backups`) and never include `controldb` or `keycloak`, the databases holding every tenant's secrets, realms and users. `Destroy` deletes the tenant folder including its backups.
- No outbound email: the owner's temporary password sits on the record for a human to copy; demos are stopped and destroyed silently.
- `TenantPlan` is a label nothing reads; there is no subscription state, no suspension, no way to sell a module. The seven feature switches are free toggles for the owner and enforced only on the UI.
- `upgrade` re-stamps on a tag with no backup first, no health gate and no way back.

Decisions taken with the user (2026-09-20): all six items plus paid modules; billing is **manual / invoice-based** for now (a platform admin records payments; shaped so a provider can be plugged in later); email via **any SMTP** (MailKit); offsite backups to an **S3-compatible bucket**.

Architecture facts that shape the design (from exploration): there are **no synchronous service-to-service calls** (house rule); coupling is only RabbitMQ integration events with one durable queue per service and an outbox on publishers. **Spaces owns tables and stations as well as rooms**, and `WaitHealthyAsync`/`TenantNaming.Services` assume all 12 services — so paid modules never remove containers; enforcement is at the gateway + Branch.API. The provisioning worker is serial (one job at a time). Migrations run at service startup and are idempotent.

## Phases — each independently shippable, in this order

| # | Phase | Why this order |
|---|---|---|
| 1 | Isolation: a Postgres role + RabbitMQ user per tenant | Small, removes the worst risk, and later phases build on its step helpers |
| 2 | Resource limits on stamped stacks | Trivial once compose is being re-stamped anyway |
| 3 | Backups: platform DBs, offsite, restore drill, keep-on-destroy | What lets you survive a dead box |
| 4 | Outbound email (SMTP) | Needed by phase 5's lifecycle mails |
| 5 | Subscription + paid modules (plans, add-ons, entitlements, Suspended) | The business feature the user asked for |
| 6 | Upgrades with automatic backup + rollback, fleet/canary | Makes the first bad release survivable |

Shared conventions: provisioning step names and audit actions ≤ 40 chars, dotted `noun.verb[.outcome]`; every new infra method gets a DryRun double; migrations via `dotnet ef migrations add <Name> --project src/Control.API`; after any API change: `dotnet build src/Control.API` → `npm run generate:api` in `src/control_web`. `TenantStatus` is stored as a string but control_web's `TENANT_STATUSES` (`src/control_web/src/lib/tenant.ts`) is index-aligned — **new statuses append only**: `Upgrading = 7` (phase 1), `Suspended = 8` (phase 5).

---

## Phase 1 — Isolation: a Postgres role and a RabbitMQ user per tenant

**Model** (`src/Control.API/Model/Tenant.cs`): `string? DbPassword`, `string? BrokerPassword` (null = still on shared credentials; every existing tenant after the migration), `TenantStatus.Upgrading = 7`. Migration `TenantCredentials`. Names (`TenantNaming.cs`): `DbRole(slug) => $"{slug}_app"`, `BrokerUser(slug) => $"{slug}_app"` (`_` is not a slug char, so no collision).

**Infra** (`src/Control.API/Platform/Infra.cs`):
```csharp
IDatabaseAdmin: EnsureRoleAsync(role, password) / EnsureDatabaseAsync(name, owner) / DropDatabaseAsync(name) / DropRoleAsync(role) / LockDownAsync(name)
IBrokerAdmin:   EnsureUserAsync(user, password) / EnsureVHostAsync(vhost, user) / ClearPermissionsAsync(vhost, user) / DeleteVHostAsync(vhost) / DeleteUserAsync(user)
```
- `NpgsqlDatabaseAdmin` (as superuser): `EnsureRoleAsync` = `create role … login password '…' nosuperuser nocreatedb nocreaterole noinherit` or `alter role … password` (rotation). `EnsureDatabaseAsync` = `create database … owner …`, or for an existing DB `alter database … owner to …` **plus** a `DO $$` block that `ALTER … OWNER TO` every table/view/sequence/function/type/schema owned by `postgres` (`REASSIGN OWNED BY postgres` is refused for the bootstrap superuser). `LockDownAsync` = `revoke all on database … from public`; a small `PlatformLockdownService` applies it once at startup to `controldb`, `keycloak`, `postgres`. Passwords come from `TenantNaming.NewSecret()` and are validated `^[A-Za-z0-9_-]{16,64}$` before being embedded (no bind parameter for `CREATE ROLE … PASSWORD`).
- `RabbitCtlBrokerAdmin` (`docker exec {RabbitContainer} rabbitmqctl …`): `list_users` → `add_user`/`change_password` → `set_user_tags {user}` (none); `set_permissions -p {vhost} {user}`; `clear_permissions -p {vhost} guest`; `delete_user`.
- `Shell.cs`: `ProcessShell.ForLog(args)` masks the argument after `add_user`/`change_password` and `PGPASSWORD=` in the command log.

**Templates** (`Templates.cs`): connection strings become `Username={slug}_app;Password=${DB_PASSWORD}` and `amqp://{slug}_app:${BROKER_PASSWORD}@…/{slug}`; `Env()` writes `DB_PASSWORD`, `BROKER_PASSWORD`, `IDENTITY_SECRET`, `GEMINI_API_KEY` — **no** `POSTGRES_PASSWORD`/`RABBIT_PASSWORD` in tenant folders any more; `Env` throws if a password is null.

**Provisioner** (`Provisioner.cs`): extract step helpers reused by phases 5/6 — `CredentialsStep` (generate + **save passwords before touching the box**, then `EnsureRole`/`EnsureUser`), `DatabasesStep`, `BrokerStep`, `StackStep(name)` (write compose + `.env`, `UpArgs`), `HealthStep`, `BrokerLockdownStep` (`clear_permissions` for `guest`). `ProvisionAsync` order: `credentials → databases → (restore-databases) → broker → realm → stack → edge → health → (restore-uploads) → brand → owner → broker-lockdown`. New `SecureAsync(tenantId, rotate)` (worker actions `secure` / `rotate`): `Status=Upgrading` → `credentials → databases → broker → stack → health → broker-lockdown` → `Running`; audit `tenant.secure.done/failed`. `DestroyAsync`: `broker-delete` also deletes the user; new `role-drop` after `databases-drop`. Until phase 6 lands, `ComposeAsync("upgrade")` runs `credentials → databases → broker` before `stack`, so the next upgrade migrates an old tenant. `Backups.RestoreDatabasesAsync` adds `--role {into}_app` to `pg_restore`.

**API / UI**: `POST /tenants/{slug}/secure?rotate=` (from Running/Stopped/Failed); `TenantSummary`/`TenantDetail` gain `hasOwnCredentials`. control_web: `Upgrading` status (amber, busy), an amber alert "Runs on the shared database and broker credentials → Secure now" on stamped tenants without their own, a "Rotate credentials" more-menu item behind a confirm dialog. i18n: `statusUpgrading, sharedCredentials, secureNow, rotateCredentials, rotateNote`.

**Tests** (`tests/Control.UnitTests`): `TemplatesTests` — connection-string/AMQP shape, no `Username=postgres` / `amqp://guest` anywhere, `Env` has no superuser password, `Env` throws without credentials; new `InfraTests` — `RabbitCtlBrokerAdmin` over `RecordingShell` records the exact `rabbitmqctl` sequence; `ForLog` masks; `TenantNamingTests` for `DbRole`/`BrokerUser`; `BackupTests` — restore carries `--role`.

**Verify on `deploy/platform/local`**: stamp `cove`; `docker exec ninja-local-postgres-1 psql -U postgres -c "\du"` shows `cove_app` with no attributes; `\l cove_*` owned by `cove_app`; connecting as `cove_app` to `controldb` → `permission denied`; `rabbitmqctl list_permissions -p cove` lists only `cove_app`. Migration path: tenant stamped on the previous build → `POST /tenants/cove/secure` → same checks, `docker compose -p ninja-cove config | grep -c Username=cove_app` = 11.

**Rollout**: existing tenants keep working until their next `upgrade`/`secure` (phase 6's fleet upgrade migrates them all). `secure` restarts the stack (~1 min).

---

## Phase 2 — Resource limits on stamped stacks

**Options** (`PlatformOptions.cs`): `ServiceMemoryMb 256`, `ServiceMemoryOverridesMb { catalog 384, inventory 384, finance 384 }` (they run the AI assistant), `GatewayMemoryMb 128`, `ServiceCpus 1.0`, `GatewayCpus 0.5`, `PidsLimit 256`, `LogMaxSize "10m"`, `LogMaxFile 3`; `MemoryFor(service)`; computed `StackLimitMb` (sum, 3584 by default). Bind with `AddOptions<PlatformOptions>().Bind(...).Validate(o => o.StackFootprintMb <= o.StackLimitMb).ValidateOnStart()`.

**Template** (`Templates.Compose`): per service and gateway emit
```yaml
    deploy: { resources: { limits: { memory: "256M", cpus: "1.0" } } }
    pids_limit: 256
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
```
(compose v2 honours `deploy.resources.limits` without swarm; `cpus` formatted invariant-culture). `CapacityResponse` gains `stackLimitMb`; capacity strip shows "{footprint} typical · {limit} cap". Reaches existing stacks on their next upgrade/secure — no migration.

**Tests**: `TemplatesTests.Compose_caps_memory_cpu_pids_and_logs_on_every_container` (count `"256M"` = 9, `"384M"` = 3, `"128M"` = 1, `pids_limit` = 13, `max-size` = 13; an override shows up once); `PlatformOptionsTests.Stack_limit_is_the_sum_of_the_service_caps`.

**Verify**: after upgrading `cove`: `docker inspect ninja-cove-cove-catalog-api-1 --format '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}} {{.HostConfig.PidsLimit}}'` → `402653184 1000000000 256`; `docker stats` shows limits. Watch `.State.OOMKilled` after the first upgrades and raise per-service overrides rather than the default.

---

## Phase 3 — Backups: platform databases, offsite copy, restore drill, keep-on-destroy

**Manifest**: `BackupInfo(..., DateTimeOffset? OffsiteAt = null, DateTimeOffset? VerifiedAt = null)`; old manifests deserialize with nulls. No Tenant columns.

**Options**: `Offsite { Endpoint, Bucket, AccessKey, SecretKey, Region="auto", Prefix }` (`Enabled` when bucket+keys set), `RestoreDrill { Enabled=false, Weekday=Sunday, Hour=4, TimeoutMinutes=15 }`, `PlatformBackupsKeep 14`, `ArchiveKeepDays 90`, `BackupFreshMinutes 60`. Plumbing: `deploy/platform/.env.example` + `docker-compose.yml` (`Platform__Offsite__* : ${OFFSITE_*:-}`, `Platform__RestoreDrill__Enabled`), `deploy-platform.yml` from optional `PLATFORM_OFFSITE_*` secrets, README. Package `AWSSDK.S3` in `Directory.Packages.props` + `Control.API.csproj` (no Dockerfile change).

**Types** (new `src/Control.API/Platform/Offsite.cs`): `IOffsiteStore { Enabled; UploadFileAsync(key, path); DeleteAsync(key) }` — `S3OffsiteStore` (`AmazonS3Client` with `ServiceURL`, `ForcePathStyle`, `TransferUtility`), `NoOffsiteStore`, `RecordingOffsiteStore` (dry run + tests). `BackupService` gains `PlatformSlug = "_platform"` (`_` never collides with a slug; `ParseRestoreFrom` rejects it), `PlatformDatabases = ["controldb","keycloak"]`, `CreatePlatformAsync()` (same `pg_dump -Fc` via `docker exec`, under `{TenantsRoot}/_platform/backups/{id}/`), `OffsiteAsync(slug, id)` (`WriteArchiveAsync` → `.tar.gz.tmp` → upload key `{prefix}{slug}/{id}.tar.gz` → manifest `OffsiteAt`), `Update(slug, id, change)`, `IsFresh(slug, minutes, out newest)`, `ArchiveLatest(slug)` (`Directory.Move` to `{TenantsRoot}/_archive/{slug}/{id}` — same volume, instant), `PruneArchive(keepDays)`.

**Jobs**: `PlatformBackupService.RunAsync()` (create → offsite → prune → audit `platform.backup.done/failed`), `Status()` → `PlatformBackupsResponse(Backups, LastAt, LastOffsiteAt, Stale)` with `IsStale = lastAt is null || now - lastAt > 26h`. `NightlyBackupService.EnqueueAllAsync` runs the platform backup first, then `PruneArchive`, then the tenants. `UntilNextRun(now, tz, hour, DayOfWeek? weekday = null)`. `RestoreDrillService` (hosted only when enabled): weekly → `Pick` the Running Customer tenant whose newest backup was verified longest ago → skip (audit `backup.drill.skipped`) unless `CapacityCache.HasRoom` → insert `Tenant { Slug = "drill-{slug}"[..24], Kind=Demo, Seed=None, ImageTag = backup's, RestoreFrom = "{slug}/{id}", ExpiresAt = now }` (so `DemoExpiryService` cleans up even if the drill dies) → enqueue `provision` → poll until Running/Failed/timeout → on success `VerifiedAt` on the source manifest, audit `backup.drill.done/failed` → always enqueue `destroy`.

**Provisioner**: `BackupAsync` adds step `offsite` when enabled (failure audited `backup.offsite.failed`, local backup stands). `DestroyAsync` first step `last-backup`: if the stack folder exists and the tenant was Running/Stopped and no backup is fresher than `BackupFreshMinutes` → `CreateAsync` (+ offsite); then `ArchiveLatest(slug)`; only then `stack-down`. Failed tenants archive the newest existing backup without a new dump.

**API**: `GET /platform/backups`, `POST /platform/backups` (synchronous, seconds), `GET /platform/backups/{id}/download`; `DeleteBackup` also best-effort deletes the offsite key. Offsite retention = bucket lifecycle (document 30 days). Platform restore is a README runbook (`pg_restore … -d controldb`).

**control_web**: platform page gets a 4th tab **Backups** (`features/platform/platform-backups.tsx`: table, "Back up now", last offsite) and a destructive alert when `stale`; tenant Backups tab gains `offsite` and `verified` columns. i18n: `tabPlatformBackups, platformBackupsNote, offsite, verified, lastOffsite, platformBackupStale, noPlatformBackups`.

**Tests** (`BackupTests` with `RecordingShell` + `RecordingOffsiteStore` in a temp dir): platform backup dumps `controldb` and `keycloak` under `_platform`; offsite uploads `blue/{id}.tar.gz` and marks the manifest, leaves no `.tmp`; archive moves the newest backup out; `PruneArchive` by age; `IsFresh`; `IsStale`; weekly `UntilNextRun`; `RestoreDrillService.Pick`; `TenantNamingTests.Drill_slug_fits_24_characters`.

**Verify on local** (MinIO as the S3 endpoint, added to `deploy/platform/local/docker-compose.yml`): `POST /platform/backups` → `ls /opt/ninja/tenants/_platform/backups/<id>` has `controldb.dump keycloak.dump manifest.json`; bucket shows `_platform/<id>.tar.gz` and, after `POST /tenants/cove/backups`, `cove/<id>.tar.gz`; enable the drill with a time a minute ahead → `drill-cove` appears, runs, is destroyed, `cove`'s manifest has `verifiedAt`; destroy `cove` → `/opt/ninja/tenants/_archive/cove/<id>/` exists.

**Risks**: archives leave the box as plaintext `.tar.gz` — use a private bucket with server-side encryption (client-side passphrase is a follow-up). The drill needs a stack's worth of RAM for ~10 min; the `HasRoom` gate keeps it off a full box.

---

## Phase 4 — Outbound email (SMTP)

**Options** (`PlatformOptions.Mail`, section `Platform:Mail`): `Host` (empty ⇒ off), `Port 587`, `UseStartTls true`, `User`, `Password`, `From`, `FromName "Ninja"`, `OpsTo` (ops mails; empty ⇒ skipped); plus `DemoWarnDays 3`, `DemoDestroyWarnDays 2`. Package `MailKit` (4.x) in `Directory.Packages.props` + `Control.API.csproj`.

**Types** (new `src/Control.API/Platform/Mail.cs`): `MailMessage(To, Subject, Html, Text, Template, Slug, ReplyTo?)`; `IMailer { Configured; SendAsync }` → `SmtpMailer` (MailKit `SmtpClient`) or `NullMailer` when unconfigured; `MailQueue` (unbounded `Channel`, callers never block); `MailSender : BackgroundService` with `internal static DeliverAsync(msg, mailer, audit, status, delay, ct)` — 3 attempts, backoff 5 s/30 s, audit `mail.sent` / `mail.failed` / `mail.skipped` `{template, to}` (source `mail`); `MailStatus` singleton (`LastSentAt, LastError, Sent, Failed, Skipped`). DI: `SmtpMailer` iff `Platform:Mail:Host` is set; `MailSender` hosted unless `IsBuild()`.

**Templates** (new `Platform/MailTemplates.cs`, static factories, strings in a private en/ar dictionary, Egyptian-Arabic voice, `<html dir="rtl">` for `ar`, values HTML-encoded, a text body alongside): `owner-welcome` (name, admin + customer URLs, email, temporary password or "the password you set"), `demo-expiring` (days left; `ReplyTo = OpsTo`), `demo-stopped`, `demo-destroyed-soon`, `subscription-past-due` (grace ends), `subscription-suspended`, `payment-received` (period, amount, reference), and ops-only `ops-provision-failed`, `ops-backup-failed`, `ops-platform-backup-stale`. Language = `tenant.DefaultLanguage`; ops mails in English.

**Triggers** (exact): `Provisioner.ProvisionAsync` on success when `WelcomeSentAt is null` → welcome, set `WelcomeSentAt`; its catch → `ops-provision-failed`; `BackupAsync` catch → `ops-backup-failed`; `NightlyBackupService` → one `ops-platform-backup-stale` when any Running tenant's newest backup is > 2 days old; `DemoExpiryService` refactored around a pure `Decide(tenant, now, graceDays, warnDays, destroyWarnDays) → None|Warn|Stop|WarnDestroy|Destroy` (query widened to upcoming expiries; `ExpiryWarnedAt`/`DestroyWarnedAt` stop repeats; `Extend` clears them); phase 5's sweep sends the subscription mails.

**Model**: `Tenant.WelcomeSentAt`, `ExpiryWarnedAt`, `DestroyWarnedAt`; migration `TenantMail`; `TenantDetail.welcomeSentAt`.

**Endpoints** (new `Apis/ControlApi.Mail.cs`): `GET /platform/mail` → `MailStatusResponse(Configured, Host, From, OpsTo, LastSentAt, LastError, Sent, Failed, Skipped)`; `POST /tenants/{slug}/mail/welcome` → 202 (409 when not Running or mail off), audit `mail.welcome.resent`.

**Keycloak SMTP too**: a `{{smtpServer}}` slot in `tenant-realm.json` and `platform-realm.json`, filled by `Templates.SmtpServerJson(mail)` (`{}` when off; Keycloak's string map `host, port, from, fromDisplayName, auth, user, password, starttls, ssl`), so password reset works in the realms (`verifyEmail` stays false). Other renderers of the templates must fill it: `deploy-platform.yml`'s Python block and `deploy/platform/local/build-images.ps1`. Already-imported realms: `IKeycloakAdmin.SetRealmSmtpAsync(realm, json)` (`PUT /admin/realms/{realm}`) behind `POST /platform/mail/realms` (loops non-Destroyed tenants; audit `mail.realms.updated`), and the workflow's kcadm block updates `ninja` when `MAIL_HOST` is set.

**Plumbing**: `deploy/platform/docker-compose.yml` `Platform__Mail__* : ${MAIL_*:-…}` (`From` defaults to `no-reply@${PLATFORM_DOMAIN}`); `.env.example`; `deploy-platform.yml` optional secrets `PLATFORM_MAIL_{HOST,PORT,USER,PASSWORD,FROM,OPS_TO}`; local stack gets a `mailpit` service (`axllent/mailpit`, UI on 8025) and points `Platform__Mail__Host: mailpit`; README replaces the "SMTP for the realms" gap.

**control_web**: more-menu "Resend welcome email" (Running); overview row "Welcome sent"; platform header line "Mail: {host} · last sent …" / "Mail not configured". i18n: `resendWelcome, welcomeQueued, welcomeSent, mailNotConfigured, mailConfigured, lastSent, never`.

**Tests**: `MailTemplatesTests` — every template × ar/en renders with no unfilled slot, `dir="rtl"` iff ar, text body has no tags, welcome carries URL/email/password (and the no-password wording); `SmtpServerJson` empty when off and Keycloak-shaped when on; realm tests assert `smtpServer` is an object. `MailSenderTests` — first-attempt success audits `mail.sent`; two failures then `mail.failed`; `NullMailer` audits `mail.skipped` without retry. `DemoExpiryTests` — the `Decide` matrix.

**Verify on local**: create a demo → `owner-welcome` in Mailpit (`http://localhost:8025`), audit `mail.sent`, overview "Welcome sent"; resend → second mail; Keycloak realm `cove` → Email shows `mailpit:1025`, "Forgot password" on the admin app delivers; stop Mailpit → resend → `mail.failed` + `lastError` on `GET /platform/mail`; set a demo's `ExpiresAt` 2 days out and restart control-api → one `demo-expiring`, none on the next tick.

**Rollout**: with `MAIL_HOST` empty nothing changes (skipped mails are audited, realms get `smtpServer: {}`). Run `POST /platform/mail/realms` once after setting the secrets.

---

## Phase 5 — Subscription and paid modules

Order inside the phase: 5.1 → 5.3 (Branch.API, deployable alone) → 5.2/5.4/5.5 → 5.6/5.7 → 5.9 → 5.8.

### 5.1 Modules and plans — new `src/Control.API/Platform/Plans.cs`
`enum Module { Spaces, Loyalty, Tabs, Inventory, Finance, Payroll, Kds }` (the seven switches). Static `PlanCatalog`: `Included(plan)` — proposed defaults **Free = {Kds}; Starter = {Spaces, Loyalty, Tabs, Kds}; Pro = all** (one table; change freely, prices stay out of code); `AddonsAvailable(plan) = All − Included`; `Entitlements(plan, addons, kind)` = Included ∪ addons, **and a Demo is entitled to everything while it is a Demo** (the single place that rule lives); `NormalizeAddons` (drops add-ons the plan includes, dedupes, fixed order); `ToFeatures(entitled)` → `{spaces: …}` JSON / `BrandFeatures`; `Routes` — the gateway paths each module owns (5.4).

### 5.2 Control-plane model
`SubscriptionStatus { Trialing, Active, PastDue, Suspended, Cancelled }`; `TenantStatus.Suspended = 8` (after phase 1's `Upgrading = 7`). On `Tenant`: `Module[] Addons` (`text[]` with element conversion + `ValueComparer`), `Subscription` (string, 16), `PaidThrough?`, `int? GraceDays` (null ⇒ `Platform.SubscriptionGraceDays`), `SuspendedAt?`, `PastDueNotifiedAt?`, `List<Payment> Payments`. New `Model/Payment.cs`: `Id, TenantId, At, Amount (12,2), Currency (3), PeriodStart, PeriodEnd, Reference?, Note?, RecordedBy` — cascade FK, index `(TenantId, Id)`. Migration `Subscription`, hand-edited `Up()` with two data statements: demos → `Trialing`; existing Customers get **all six non-Kds add-ons** so nobody loses a module. Options: `SubscriptionGraceDays 7`, `SubscriptionSweepHour 6`, `SubscriptionPeriodDays 30`.

### 5.3 Branch.API — entitlements, clamp, control-only endpoint, 402 page
- `src/Branch.API/Model/Tenant.cs`: seven `bool *Entitled = true` (dev AppHost and the Chillax single stack unchanged); `Features`/`Entitlements` projections; `ApplyFeatures(requested)` = `requested.Clamp(Entitlements)` (**an owner may switch an entitled module off, never an unentitled one on**); `ApplyEntitlements(entitled)` sets `*Entitled` then re-clamps `*Enabled`. Move `TenantFeatures` into `Model` and give it `Clamp`. Migration `TenantEntitlements`.
- `src/Branch.API/Apis/TenantApi.cs`: `UpdateTenant` → `tenant.ApplyFeatures(...)`; `TenantResponse` gains `entitlements: TenantFeatures`; new `PUT api/tenant/entitlements` (`.RequireAuthorization("Control")`) → `ApplyEntitlements`, bump `UpdatedAt`; new anonymous `api/tenant/module-off` on GET/POST/PUT/DELETE/PATCH (`ExcludeFromDescription`) → `402 Payment Required` ProblemDetails `{ type: "module-off", title: "Module not in plan", module }`.
- Policy **"Control"** in `src/Branch.API/Extensions/Extensions.cs`: `RequireAuthenticatedUser().RequireClaim("azp", "ninja-control")` — the control plane's client-credentials token carries `azp` (`MapInboundClaims=false` keeps it), and it needs no Keycloak change on already-stamped realms (a realm role would).
- Regenerate: `dotnet build src/Branch.API` → `npm run generate:api` in `src/admin_web` (others optional; additive). Control.API mirrors: `BrandDto.Entitlements?` (null from an older stack ⇒ all entitled); `DryRunStackProxy` handles the new endpoint and clamps.

### 5.4 Gateway enforcement — `Templates.cs`
`PlanCatalog.Routes`: Inventory `/api/inventory/{*any}`; Finance `/api/finance/{*any}`; Payroll `/api/payroll/{*any}`; Loyalty `/api/loyalty/{*any}`; Tabs `/api/accounts/{*any}`; **Spaces** `/api/stays/{*any}` plus the timed-place routes `/api/places/available`, `/api/places/{id}/tariff`, `/{id}/hold`, `/{id}/walk-in`, `/{id}/join`, `/{id}/stays` (verified against `src/Spaces.API/Apis`); `/api/places/{*any}` itself stays with spaces because tables and stations live there. Kds: UI only, no route.
`GatewayRoutes()` stays (== fully entitled; the AppHost contract test keeps using it). New overload `GatewayRoutes(IReadOnlySet<Module> entitled)`: an unentitled module's route is **replaced** (same path, never a duplicate) by `(path, "branch", versions: null, transforms: [[PathSet=/api/tenant/module-off], [QueryValueParameter=module, Set=<module>]])`; unentitled Spaces additionally emits the six place routes; give blocking routes `__ORDER: "-1"` so they win over `/api/places/{*any}` regardless of template precedence. `Compose()` calls it with `PlanCatalog.Entitlements(tenant)`. All 12 containers keep running; health routes untouched.

### 5.5 Provisioner
- Brand step seeds `features` = entitlements (restores keep saved `Enabled`); new step `entitlements` right after it → `TenantEntitlementsService.PushAsync(tenant)` (`ITenantStack.PushEntitlementsAsync` → `PUT /api/tenant/entitlements` with `StackAuth.Control`; DryRun double).
- New job `entitlements` → `EntitlementsAsync`: step `stack` (rewrite compose + `.env`; if Running `compose up -d --remove-orphans` **without pull** — only the gateway's env changed so only it recreates, seconds) → step `entitlements` (push when Running, else "pushed on start"). Audit `tenant.entitlements.done/failed`; status unchanged.
- `ComposeAsync`: `stop|suspend` → `compose stop` (Status `Stopped`/`Suspended`, `SuspendedAt ??= now`); `start|resume` → rewrite files then `compose up -d` (applies a compose rewritten while stopped; no pull) then push entitlements; `upgrade` as today until phase 6. Worker: `case "entitlements"`.

### 5.6 Subscription service and sweep — new `Platform/Subscriptions.cs`
`SubscriptionService`: `ApplyAsync(t, plan, addons, graceDays)` (normalise, save, audit `subscription.changed`, enqueue `entitlements` when stamped); **`RecordPaymentAsync(...)` is the one "payment happened" entry point** — `PaidThrough = max(PaidThrough ?? now, periodEnd)`, `Subscription = Active`, clear `PastDueNotifiedAt`, if `Status == Suspended` enqueue `resume`, audit `payment.recorded`, mail `payment-received` (a provider webhook later calls exactly this); `SuspendAsync(t, reason)` → `Subscription = Suspended`, enqueue `suspend`, audit `subscription.suspended`, mail. Pure `SubscriptionSweep.Decide(t, today, defaultGrace) → None|PastDue|Suspend` (Customers with `PaidThrough` only; Cancelled never; `today` is the platform's local date). `SubscriptionSweepService` daily at `SubscriptionSweepHour` via `UntilNextRun`: PastDue → status + `PastDueNotifiedAt` + mail; Suspend → `SuspendAsync`.
`Convert`: `Subscription = Active`, `PaidThrough = request.PaidThrough ?? now + SubscriptionPeriodDays`, then `ApplyAsync` (narrows a demo from "everything" to its plan). `CreateTenant`: `Addons = NormalizeAddons`, `Subscription = Demo ? Trialing : Active`. `UpdateTenantRequest.Plan` becomes nullable and routes through `ApplyAsync`.
Status gates: `start` refuses Suspended (409 "resume it or record a payment"); `suspend` from Running/Stopped; `resume` from Suspended; `destroy`/`backup` add Suspended; `tls/ask` unchanged (certificates stay valid).

### 5.7 Endpoints — new `Apis/ControlApi.Subscription.cs` (policy Platform)
| | |
|---|---|
| `GET /platform/plans` | `PlanCatalogResponse(Modules, Plans[{Plan, Included, Addons}])` |
| `GET /tenants/{slug}/subscription` | `SubscriptionDetail(Plan, Addons, Included, AddonsAvailable, Entitlements, Status, PaidThrough, GraceDays, SuspendedAt, PastDueNotifiedAt, Payments[])` |
| `PUT /tenants/{slug}/subscription` | `UpdateSubscriptionRequest(Plan, Addons, GraceDays? 0–90)` → `SubscriptionDetail` |
| `POST /tenants/{slug}/subscription/payments` | `RecordPaymentRequest(Amount > 0, Currency ISO-4217, PeriodEnd, PeriodStart?, Reference?, Note?)` → 201; 409 for a Demo ("convert first"); `RecordedBy` from the token |
| `POST …/subscription/suspend`, `POST …/subscription/resume` | 202 / 409 by status; resume sets `Active` (UI warns the sweep may suspend again if still unpaid) |

`ConvertRequest(Plan?, Addons?, PaidThrough?)`; `CreateTenantRequest.Addons?`; `TenantSummary` + `Subscription, PaidThrough`; `TenantDetail` + `Subscription {Status, PaidThrough, GraceDays, SuspendedAt, Addons, Entitlements}`.

### 5.8 Edge "paused" page (minimal)
`deploy/platform/Caddyfile` `(tenant_api)` snippet and the `api.*` site: `handle_errors 502 503 { @api path /api/* /hub/*; handle @api { header Content-Type application/json; respond `{"code":"paused"}` 503 } }` (local Caddyfile: one block at the site level). `src/client_web/src/lib/brand.ts` `bootBrand`: a 503 `paused` on `GET /api/tenant` sets a `usePaused` store; new `components/paused-screen.tsx` (neutral N tile, "This menu is paused right now." / "القائمة متوقفة مؤقتًا.", no i18n dependency) rendered from the root when paused. Staff apps: nothing beyond the JSON.

### 5.9 UI
**control_web**: `TENANT_STATUSES` + `'Upgrading'`, `'Suspended'` (indices 7, 8); `SUBSCRIPTION_STATUSES`, `MODULES` (labels reuse `featureRooms…featureKds`); `canSuspend/canResume`, `isStamped/canBackup/canDestroy` include Suspended; `SubscriptionBadge`; Suspended status styled rose. Tenant page: tab **Subscription** (`tabs/subscription.tsx`: plan select + add-on checkboxes with "included in plan" state and the Demo hint, entitlements preview, status/paidThrough/grace/suspendedAt, Record payment / Suspend / Resume, payments table), header `SubscriptionBadge`, Suspend in the more-menu, Resume as a primary button. `dialogs.tsx`: `RecordPaymentDialog` (currency defaults to the tenant's, periodEnd defaults max(paidThrough, today)+30d), `SuspendDialog`; `ConvertDialog` gains "paid through". `edit-record-sheet.tsx` drops the plan select (it lives on the tab now); `new-tenant.tsx` adds add-on checkboxes from `/platform/plans`. Tenants table: subscription badge when not Active/Trialing; "Paid through" replaces "Expires" for customers. Brand tab: unentitled switches disabled + `notInPlan` badge. i18n: `tabSubscription, subscription, addons, includedInPlan, notInPlan, entitlements, demoHasEverything, subscriptionStatus, subTrialing…subCancelled, paidThrough, graceDays, suspendedAt, recordPayment, amount, currency, periodStart, periodEnd, reference, note, payments, noPayments, recordedBy, paymentRecorded, suspend, resume, suspendConfirm, statusSuspended, statusUpgrading, subscriptionSaved, resumeUnpaidHint`.
**admin_web**: `useEntitlements()` in `lib/brand.ts`; Brand page switches `disabled={!entitled}` with a lock icon + "Not in your plan" (`notInPlan` en/ar). Sidebar/dashboard need nothing — `features` arrive already clamped.
**kds_web** (so Kds is a real module): full-screen "Not in your plan" notice when `features.kds === false`; the pos "send to kitchen" step stays as is.

### 5.10 Tests
`PlanCatalogTests` (included/addons/entitlements/demo rule/normalize/`ToFeatures` casing); `TemplatesTests` — Starter customer routes `/api/inventory/{*any}` to `branch` with `PathSet=/api/tenant/module-off` and `Set=inventory` and no `inventory` cluster route, `/api/places/{*any}` still `spaces`; Free blocks stays + the six place routes but not places itself; a Pro customer and a Free demo render no `module-off` route and `GatewayRoutes(All)` equals `GatewayRoutes()`; `SubscriptionSweepTests` — the `Decide` matrix incl. per-row `GraceDays`; `tests/Branch.UnitTests/TenantEntitlementsTests` — clamp never enables an unentitled module, owner can disable an entitled one, re-applying entitlements re-clamps, defaults are all-entitled.

### 5.11 Verify on local
Existing `cove`: subscription shows the six add-ons, entitlements all seven, upgrade → compose has no `module-off` (`grep -c module-off /opt/ninja/tenants/cove/docker-compose.yaml` = 0). Convert to Customer/Starter → `entitlements` job (only the gateway recreates) → `curl -k --resolve api.cove.localhost:443:127.0.0.1 https://api.cove.localhost/api/inventory/items` → **402** `{type:"module-off", module:"inventory"}`; `/api/places` unaffected; `/api/tenant` → `features.inventory:false, entitlements.inventory:false`. Admin app: no Inventory/Finance/Payroll in the sidebar, Brand page shows them locked; a forged `PUT /api/tenant` with `inventory:true` comes back `false`. Add the Inventory add-on → 402 gone, sidebar back. Record a payment → audit + `payment-received` mail; push `PaidThrough` 10 days back → sweep → PastDue + mail; 20 days → `suspend`, tenant Suspended, `https://cove.localhost` shows the paused screen, `/api/tenant` → 503 `{"code":"paused"}`, `start` → 409, `tls/ask` → 200; record a payment → `resume`, Running.

### 5.12 Rollout
Branch.API first (or together): `*Entitled` default true, so the Chillax single stack and every stamped stack keep all switches until the control plane pushes. The Control migration grants existing Customers all six add-ons and leaves `PaidThrough` null, so their gateways render unchanged and the sweep never touches them; demos are entitled to everything by rule. Gateways change only when re-stamped (`upgrade`, `entitlements`, `start`/`resume`). Ship `TENANT_STATUSES` with the API (an older UI would mislabel index 7/8). When Chillax moves onto a stamp, create it as Customer/Pro.

---

## Phase 6 — Upgrades with automatic backup and rollback; fleet upgrade with a canary

**Model**: `Tenant.PreviousImageTag` (max 64), `Tenant.UpgradeBackupId` (the backup taken/reused right before the last upgrade — what to restore if a rollback would cross a migration). Migration `TenantUpgradeRollback`. `ProvisioningJob(TenantId, Action, string? ImageTag = null, Guid? CanaryId = null)` — the tag lives on the job, so a queued fleet upgrade that never runs leaves the record untouched.

**Provisioner**: `UpgradeAsync(tenantId, imageTag, canaryId)` replaces `ComposeAsync("upgrade")`:
1. Canary gate: if `canaryId` is set and that tenant is not `Running` on `imageTag` → audit `tenant.upgrade.skipped`, return.
2. `Status=Upgrading`; if the tag changes: `PreviousImageTag = ImageTag; ImageTag = imageTag`.
3. Steps `credentials → databases → broker → backup` (reuse a backup fresher than `BackupFreshMinutes`, else create + prune + offsite; set `UpgradeBackupId`) `→ stack → health` (5 min).
4. Success: `Running`, `LastError=null`, audit `tenant.upgrade.done {from,to,backupId}`.
5. Failure in `stack`/`health` with a different `PreviousImageTag`: swap back, steps `rollback → rollback-health`; success → `Running` with `LastError = "upgrade to {tag} rolled back: …"`, audit `tenant.upgrade.rolledback`; failure → `Failed`. No previous tag → `Failed` as today.

`RollbackAsync(tenantId)`: needs `PreviousImageTag`; swap tags; `stack → health`; audit `tenant.rollback.done/failed`. `ComposeAsync` keeps only `stop`/`start`.

**API**: `POST /upgrade` validates the tag (`^[A-Za-z0-9._-]{1,64}$`) and enqueues without mutating the record; `POST /tenants/{slug}/rollback` (409 without a previous tag; from Running/Failed); `POST /platform/upgrade` `FleetUpgradeRequest(ImageTag, Canary?)` → canary enqueued first, the rest with `CanaryId`; returns `Accepted { Queued, Canary }`, audit `platform.upgrade`. Serial worker = concurrency 1. `TenantDetail` gains `previousImageTag`, `upgradeBackupId`.

**control_web**: `UpgradeDialog` note "A backup is taken first; if not healthy in 5 minutes the stack rolls back to {tag}"; `RollbackDialog` with the forward-only-migrations warning linking `upgradeBackupId` in the Backups tab; more-menu "Roll back to {tag}" when `previousImageTag`; amber "rolled back" alert when Running with `lastError`; overview row `previousVersion`; platform page "Upgrade all" → `FleetUpgradeDialog` (tag, optional canary select). i18n: `upgradeNote, rollback, rollbackTo, rollbackTitle, rollbackNote, previousVersion, rolledBack, upgradeAll, canary, canaryNote, fleetUpgradeQueued`.

**Tests**: new `ProvisionerTests.cs` (Sqlite/in-memory `ControlContext`, `RecordingShell`, dry-run admins, an `ITenantStack` stub that can fail health once, `RecordingOffsiteStore`): upgrade takes/reuses a backup and records tags; rolls back when health fails (steps `…, rollback, rollback-health`, compose on disk names the old tag); no previous tag fails plainly; rollback swaps and re-stamps; canary gate skips the rest. Tag validation rejects `v2 ; rm`.

**Verify on local** (`PullImages=false`): tag the 12 `:local` images as `:v2`; upgrade `cove` → passes through `Upgrading`, ends `Running`, overview shows previous `local`, a fresh backup in the tab; rollback → `local`; upgrade to `nope` → `stack` fails, `rollback`/`rollback-health` done, amber alert, audit `tenant.upgrade.rolledback`; fleet with `canary: cove` and a bad tag → the other tenant gets `tenant.upgrade.skipped`.

**Risks**: rollback restores the image, never the data — the dialog and audit point at `UpgradeBackupId`; restoring it means a new slug (existing restore path). Floating tags (`latest`→`latest`) have nothing to roll back to: use immutable tags in production. A failed upgrade holds the serial queue ~12 min.

---

## Cross-cutting

- **Status enum**: `Upgrading = 7` (phase 1), `Suspended = 8` (phase 5); control_web `TENANT_STATUSES`, `statusLabelKey`, `statusClass`, `isBusy`/`isStamped` updated in the same PR as each.
- **Job actions** after all phases: `provision, destroy, edge, backup, stop, start, secure, rotate, entitlements, suspend, resume, upgrade, rollback` — all through the one serial `ProvisioningWorker`; `ProvisioningJob(TenantId, Action, ImageTag?, CanaryId?)`.
- **Provisioner step helpers** (`CredentialsStep, DatabasesStep, BrokerStep, StackStep(name), HealthStep, BrokerLockdownStep, BackupStep`) are introduced in phase 1 and reused by 3, 5, 6 — keep `ProvisionAsync` a list of named steps, no inline docker calls.
- **Secrets never in tenant folders or logs**: `.env` carries only the tenant's own passwords; `ProcessShell.ForLog` masks them.
- **Deploy plumbing per phase** lands in the same PR: `deploy/platform/docker-compose.yml`, `deploy/platform/local/docker-compose.yml` (+ mailpit, minio), `.env.example`, `deploy-platform.yml`, `deploy/platform/README.md`.
- **Every API change**: `dotnet build src/Control.API` (regenerates `Control.API.json`) → `npm run generate:api` in `src/control_web`; Branch.API likewise for `src/admin_web`.

## Suggested PR slices

1. Phase 1 (isolation) + phase 2 (limits) — one PR: both only touch `Templates`, `Infra`, `Provisioner`, options, tests.
2. Phase 3 backups — one PR (platform DBs + offsite + keep-on-destroy), restore drill can be a follow-up PR.
3. Phase 4 mail.
4. Phase 5a Branch.API entitlements (deployable alone, no behaviour change); 5b control plane subscription + gateway enforcement + UI; 5c paused page.
5. Phase 6 upgrades/rollback/fleet.

## End-to-end verification (after all phases, on `deploy/platform/local`)

`dotnet build`; `dotnet test --project tests/Control.UnitTests`; `dotnet test --project tests/Branch.UnitTests`; `dotnet test --project tests/Ninja.Contracts.Tests` (unchanged, must stay green); `npm run generate:api && npm run build` in `src/control_web` and `src/admin_web`; `npm run build` in `src/client_web`; `.\build-images.ps1; docker compose up -d --build`. Then the per-phase checks above in order: stamp `cove` (own DB role/user, limits on containers, welcome mail) → platform backup + offsite in MinIO → convert to Starter and see the 402 + locked switches → record payment / force past-due / suspended + paused screen / resume → tag images `v2`, upgrade with a canary, break a tag and watch the rollback → destroy and find the archived backup.
