using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>
/// What the control plane needs to know about the box it runs on and the
/// shared services every tenant stack plugs into. Set through configuration
/// (Platform__*); nothing here is per tenant.
/// </summary>
public sealed class PlatformOptions
{
    public const string Section = "Platform";

    /// <summary>The domain tenants hang off: {slug}.{Domain} for customers, admin.{slug}.{Domain} and so on for staff.</summary>
    public string Domain { get; set; } = "ninja.local";

    /// <summary>https everywhere but on a laptop, where the edge speaks plain http on *.localhost.</summary>
    public string Scheme { get; set; } = "https";

    /// <summary>Pull images before bringing a stack up; off when the images were built on this box.</summary>
    public bool PullImages { get; set; } = true;

    /// <summary>Where the control app itself is served; goes into the platform realm's client.</summary>
    public string ControlUrl { get; set; } = "http://localhost:5177";

    /// <summary>The download page for the native till and kitchen apps: the edge serves it on the platform's own domain (deploy/platform/apps).</summary>
    public string AppsUrl => $"{Scheme}://{Domain}/apps";

    /// <summary>Where each tenant's compose project, env and uploads are written on the host.</summary>
    public string TenantsRoot { get; set; } = "/opt/ninja/tenants";

    /// <summary>Image name prefix; the twelve services are {ImageRegistry}-{service}:{tag}.</summary>
    public string ImageRegistry { get; set; } = "ghcr.io/achmstein/ninja";

    /// <summary>The tag a new tenant starts on.</summary>
    public string DefaultImageTag { get; set; } = "latest";

    /// <summary>The gateway image every stack runs; the same one the single stack used.</summary>
    public string GatewayImage { get; set; } = "mcr.microsoft.com/dotnet/nightly/yarp:2.3.0-preview.4";

    /// <summary>The docker network the shared services live on; every tenant stack joins it.</summary>
    public string Network { get; set; } = "aspire";

    /// <summary>The shared Postgres as the tenant stacks reach it: host name on the network, and the superuser that creates databases.</summary>
    public string PostgresHost { get; set; } = "postgres";

    public int PostgresPort { get; set; } = 5432;

    public string PostgresUser { get; set; } = "postgres";

    public string PostgresPassword { get; set; } = "postgres";

    /// <summary>The shared RabbitMQ container (for rabbitmqctl) and the user the stacks connect as.</summary>
    public string RabbitContainer { get; set; } = "ninja-eventbus-1";

    public string RabbitHost { get; set; } = "eventbus";

    public string RabbitUser { get; set; } = "guest";

    public string RabbitPassword { get; set; } = "guest";

    /// <summary>Keycloak as the stacks reach it on the network, and as browsers reach it.</summary>
    public string KeycloakInternalUrl { get; set; } = "http://keycloak:8080";

    public string KeycloakPublicUrl { get; set; } = "https://auth.ninja.local";

    public string KeycloakAdminUser { get; set; } = "admin";

    public string KeycloakAdminPassword { get; set; } = "admin";

    /// <summary>Shared assistant key handed to every stack; empty leaves the assistant off.</summary>
    public string? GeminiApiKey { get; set; }

    /// <summary>The one Google and one Apple app every tenant's customers sign in with; empty leaves social sign-in off.</summary>
    public SocialOptions Social { get; set; } = new();

    /// <summary>How long a demo lives before it is stopped, and how long a stopped demo waits before it is destroyed.</summary>
    public int DemoDays { get; set; } = 14;

    public int DemoGraceDays { get; set; } = 7;

    /// <summary>The Caddy snippet holding one site per custom customer domain, and the edge container to reload after writing it.</summary>
    public string EdgeSnippetPath { get; set; } = "/opt/ninja/platform/custom-domains.caddy";

    public string EdgeContainer { get; set; } = "ninja-caddy-1";

    /// <summary>The shared Postgres container (for pg_dump and pg_restore through docker exec).</summary>
    public string PostgresContainer { get; set; } = "ninja-postgres-1";

    /// <summary>What one stack typically takes on the box, and what to keep free for the shared services; a stamp is refused when they do not fit.</summary>
    public int StackFootprintMb { get; set; } = 2048;

    public int ReserveMb { get; set; } = 1024;

    /// <summary>
    /// What each container of a stack may take at most, stamped into its
    /// compose file: memory per service (the ones that run the assistant get
    /// more), the gateway's, CPUs, processes, and how much log docker keeps
    /// per container. One café's runaway service ends at its own cap, not at
    /// the box.
    /// </summary>
    public int ServiceMemoryMb { get; set; } = 256;

    public Dictionary<string, int> ServiceMemoryOverridesMb { get; set; } = new() { ["catalog"] = 384, ["inventory"] = 384, ["finance"] = 384 };

    public int GatewayMemoryMb { get; set; } = 128;

    public double ServiceCpus { get; set; } = 1.0;

    public double GatewayCpus { get; set; } = 0.5;

    public int PidsLimit { get; set; } = 256;

    public string LogMaxSize { get; set; } = "10m";

    public int LogMaxFile { get; set; } = 3;

    public int MemoryFor(string service) => ServiceMemoryOverridesMb.TryGetValue(service, out var mb) ? mb : ServiceMemoryMb;

    /// <summary>The most a whole stack may take: what the caps of all twelve services add up to (3584 MB by default); a plan that stamps fewer takes less. The footprint above is what it typically takes and must fit under this.</summary>
    public int StackLimitMb => TenantNaming.Services.Sum(MemoryFor) + GatewayMemoryMb;

    /// <summary>How often the box is read for the capacity view.</summary>
    public int CapacityRefreshSeconds { get; set; } = 30;

    /// <summary>The floor on the tenants drive: below it no backup is taken and no stack is stamped, and ops hears. Backups grow it; a full disk takes the shared Postgres down for every café.</summary>
    public int MinFreeDiskMb { get; set; } = 5120;

    /// <summary>A job running longer than this is reported to ops (nothing is killed: a big restore is slow).</summary>
    public int JobTimeoutMinutes { get; set; } = 45;

    /// <summary>
    /// What the shared Postgres allows (its max_connections), the most one
    /// service's pool may open (stamped into its connection string, the
    /// ceiling a runaway hits), and what one service typically holds (what
    /// the capacity guard counts: eleven services a stack, plus the
    /// platform's own forty). A pool is lazy and mostly idle, so the guard
    /// counts the typical number, not the ceiling.
    /// </summary>
    public int PostgresMaxConnections { get; set; } = 400;

    public int ServicePoolSize { get; set; } = 20;

    public int ServiceConnectionsEstimate { get; set; } = 4;

    /// <summary>Keycloak's readiness, on its management port; what /health asks.</summary>
    public string KeycloakHealthUrl { get; set; } = "http://keycloak:9000/health/ready";

    /// <summary>How often the stacks are checked against what their tags point to now (the registry, when the platform pulls).</summary>
    public int UpdateRefreshSeconds { get; set; } = 600;

    /// <summary>A login for the registry, needed only while the service packages are private.</summary>
    public RegistryOptions Registry { get; set; } = new();

    /// <summary>The platform's own clock (the nightly jobs), IANA.</summary>
    public string TimeZone { get; set; } = "Africa/Cairo";

    /// <summary>When the nightly backup runs, in that zone, and how many backups each tenant keeps.</summary>
    public int BackupHour { get; set; } = 3;

    public int BackupsKeep { get; set; } = 7;

    /// <summary>The platform's own databases (controldb, keycloak) are backed up before the tenants, under {TenantsRoot}/_platform; how many to keep.</summary>
    public int PlatformBackupsKeep { get; set; } = 14;

    /// <summary>A destroyed tenant's last backup is kept under {TenantsRoot}/_archive for this long.</summary>
    public int ArchiveKeepDays { get; set; } = 90;

    /// <summary>A backup this young is reused rather than taken again (destroy now, upgrade later).</summary>
    public int BackupFreshMinutes { get; set; } = 60;

    /// <summary>Where a copy of every backup goes, off the box: any S3-compatible bucket. Off until a bucket and keys are set.</summary>
    public OffsiteOptions Offsite { get; set; } = new();

    /// <summary>The weekly proof that a backup restores: one tenant's latest backup into a scratch stack, then destroyed.</summary>
    public RestoreDrillOptions RestoreDrill { get; set; } = new();

    /// <summary>How the platform writes to owners and to whoever runs it; off (and audited as skipped) until a host is set.</summary>
    public MailOptions Mail { get; set; } = new();

    /// <summary>A demo's owner hears this many days before it stops, and this many before a stopped one is destroyed.</summary>
    public int DemoWarnDays { get; set; } = 3;

    public int DemoDestroyWarnDays { get; set; } = 2;

    /// <summary>Customers: days past the paid period before the stack is suspended, when the daily sweep looks (platform time), and what a conversion or a payment without a period covers.</summary>
    public int SubscriptionGraceDays { get; set; } = 7;

    public int SubscriptionSweepHour { get; set; } = 6;

    public int SubscriptionPeriodDays { get; set; } = 30;

    /// <summary>Renders and records every step but touches no docker, database, broker or realm. Dev and tests.</summary>
    public bool DryRun { get; set; }

    /// <summary>The control app's operators are managed in the real platform realm even on a dry run (dev, where control-web signs in against it).</summary>
    public bool LiveOperators { get; set; }

    /// <summary>
    /// Base64 of 32 random bytes (openssl rand -base64 32): what the tenants'
    /// secrets are encrypted under in controldb. Required unless DryRun. Lose
    /// it and every stack's passwords are lost with it; it is part of what a
    /// platform restore needs, next to the backups.
    /// </summary>
    public string? EncryptionKey { get; set; }

    /// <summary>The plans whose stacks get the shared assistant key; a demo always does. Everything else runs with the assistant off.</summary>
    public TenantPlan[] AssistantPlans { get; set; } = [TenantPlan.Pro];

    /// <summary>Whether this tenant's stack is handed the assistant key.</summary>
    public bool AssistantFor(Tenant tenant)
        => !string.IsNullOrEmpty(GeminiApiKey) && (tenant.Kind == TenantKind.Demo || AssistantPlans.Contains(tenant.Plan));
}

public sealed class RegistryOptions
{
    /// <summary>The user and a token with read access to the packages (on GHCR, a PAT with read:packages).</summary>
    public string? User { get; set; }

    public string? Token { get; set; }
}

public sealed class OffsiteOptions
{
    /// <summary>The service URL ("https://s3.eu-central-003.backblazeb2.com", "https://{account}.r2.cloudflarestorage.com"); empty for AWS itself.</summary>
    public string? Endpoint { get; set; }

    public string? Bucket { get; set; }

    public string? AccessKey { get; set; }

    public string? SecretKey { get; set; }

    /// <summary>What the provider wants signed; "auto" suits R2 and B2, a region name suits AWS.</summary>
    public string Region { get; set; } = "auto";

    /// <summary>In front of every key, for a bucket shared with something else ("ninja/").</summary>
    public string Prefix { get; set; } = "";

    public bool Enabled => !string.IsNullOrWhiteSpace(Bucket) && !string.IsNullOrWhiteSpace(AccessKey) && !string.IsNullOrWhiteSpace(SecretKey);
}

public sealed class MailOptions
{
    /// <summary>The SMTP host; empty leaves mail off.</summary>
    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public bool UseStartTls { get; set; } = true;

    public string? User { get; set; }

    public string? Password { get; set; }

    public string From { get; set; } = "no-reply@ninja.local";

    public string FromName { get; set; } = "Ninja";

    /// <summary>Where the mails for whoever runs the platform go (a failed stamp, a failed backup); empty skips them.</summary>
    public string? OpsTo { get; set; }

    public bool Configured => !string.IsNullOrWhiteSpace(Host);
}

/// <summary>
/// The provider apps the whole platform signs customers in with. They belong
/// to Ninja, not to a café: a café would need its own paid Apple account and
/// a walk through the Google console before it could sell a coffee. One app
/// each, shared by every realm. Empty leaves a realm with no providers at
/// all, which is better than broken ones.
/// </summary>
public sealed class SocialOptions
{
    public SocialProviderOptions Google { get; set; } = new();

    public SocialProviderOptions Apple { get; set; } = new();
}

public sealed class SocialProviderOptions
{
    /// <summary>The shared app's client id (Apple: the Services ID).</summary>
    public string? ClientId { get; set; }

    /// <summary>Apple's is a JWT signed with the .p8 key and expires; rotate-apple-secret.yml renews it.</summary>
    public string? ClientSecret { get; set; }

    /// <summary>Both halves, or this provider stays off.</summary>
    public bool Configured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}

public sealed class RestoreDrillOptions
{
    public bool Enabled { get; set; }

    public DayOfWeek Weekday { get; set; } = DayOfWeek.Sunday;

    /// <summary>In the platform's zone, after the nightly backups have run.</summary>
    public int Hour { get; set; } = 4;

    /// <summary>How long the scratch stack gets to come up healthy before the drill counts as failed.</summary>
    public int TimeoutMinutes { get; set; } = 15;
}
