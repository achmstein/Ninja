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

    /// <summary>What one stack takes on the box, and what to keep free for the shared services; a stamp is refused when they do not fit.</summary>
    public int StackFootprintMb { get; set; } = 2048;

    public int ReserveMb { get; set; } = 1024;

    /// <summary>How often the box is read for the capacity view.</summary>
    public int CapacityRefreshSeconds { get; set; } = 30;

    /// <summary>The platform's own clock (the nightly jobs), IANA.</summary>
    public string TimeZone { get; set; } = "Africa/Cairo";

    /// <summary>When the nightly backup runs, in that zone, and how many backups each tenant keeps.</summary>
    public int BackupHour { get; set; } = 3;

    public int BackupsKeep { get; set; } = 7;

    /// <summary>Renders and records every step but touches no docker, database, broker or realm. Dev and tests.</summary>
    public bool DryRun { get; set; }
}
