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

    /// <summary>The most a whole stack may take: what its caps add up to (3584 MB by default). The footprint above is what it typically takes and must fit under this.</summary>
    public int StackLimitMb => TenantNaming.Services.Sum(MemoryFor) + GatewayMemoryMb;

    /// <summary>How often the box is read for the capacity view.</summary>
    public int CapacityRefreshSeconds { get; set; } = 30;

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

public sealed class RestoreDrillOptions
{
    public bool Enabled { get; set; }

    public DayOfWeek Weekday { get; set; } = DayOfWeek.Sunday;

    /// <summary>In the platform's zone, after the nightly backups have run.</summary>
    public int Hour { get; set; } = 4;

    /// <summary>How long the scratch stack gets to come up healthy before the drill counts as failed.</summary>
    public int TimeoutMinutes { get; set; } = 15;
}
