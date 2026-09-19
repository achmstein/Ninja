namespace Ninja.Control.API.Model;

public enum TenantKind
{
    /// <summary>A prospect's instance: expires, then is stopped and later destroyed.</summary>
    Demo = 0,
    /// <summary>A paying café.</summary>
    Customer = 1,
}

public enum TenantStatus
{
    Requested = 0,
    Provisioning = 1,
    Running = 2,
    Stopped = 3,
    Failed = 4,
    Destroying = 5,
    Destroyed = 6,
}

/// <summary>
/// What the stack's empty databases are planted with (the services read it
/// as <c>Seed__Profile</c>). A demo gets the sample café so it looks alive;
/// a customer starts empty and fills the menu from the admin app.
/// </summary>
public enum TenantSeed
{
    None = 0,
    Sample = 1,
}

/// <summary>What the café pays for; the names are the platform's, the prices are not in the code.</summary>
public enum TenantPlan
{
    Free = 0,
    Starter = 1,
    Pro = 2,
}

/// <summary>The locale defaults a tenant starts with: tenant one's, so Chillax is unchanged.</summary>
public static class TenantLocale
{
    public const string DefaultCountry = "EG";
    public const string DefaultCurrency = "EGP";
    public const string DefaultTimeZone = "Africa/Cairo";
    public const string DefaultLanguage = "ar";

    public static readonly string[] Languages = ["ar", "en"];
}

/// <summary>
/// One café on the platform: a full stack of its own under one compose
/// project, its own databases on the shared Postgres, its own realm, its own
/// RabbitMQ vhost. The slug names all of them and every host the café gets.
/// </summary>
public class Tenant
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Lower-case letters, digits and single dashes, 3–24 characters; the compose project is ninja-{slug}.</summary>
    public string Slug { get; set; } = "";

    public string NameEn { get; set; } = "";

    public string? NameAr { get; set; }

    public TenantKind Kind { get; set; }

    public TenantStatus Status { get; set; } = TenantStatus.Requested;

    /// <summary>Chosen at creation (demos default to the sample café); the stack reads it once, on its first boot.</summary>
    public TenantSeed Seed { get; set; }

    /// <summary>ISO 3166-1 alpha-2; decides the phone pattern of the realm and the defaults below.</summary>
    public string Country { get; set; } = TenantLocale.DefaultCountry;

    /// <summary>ISO 4217; what every price is shown in.</summary>
    public string Currency { get; set; } = TenantLocale.DefaultCurrency;

    /// <summary>IANA zone; the café's business day and its offers' hours.</summary>
    public string TimeZone { get; set; } = TenantLocale.DefaultTimeZone;

    /// <summary>"ar" or "en": what the customer app opens in.</summary>
    public string DefaultLanguage { get; set; } = TenantLocale.DefaultLanguage;

    /// <summary>The brand color seeded into the stack; the owner can change it there.</summary>
    public string? PrimaryColor { get; set; }

    /// <summary>A café's own customer host ("menu.cafe.com") once its DNS points here; null means {slug}.{platform domain}.</summary>
    public string? CustomerDomain { get; set; }

    public string OwnerEmail { get; set; } = "";

    /// <summary>The café's record on the platform: who to call, where it is, what it pays, what was agreed.</summary>
    public string? ContactName { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public TenantPlan Plan { get; set; }

    public string? Notes { get; set; }

    /// <summary>The first owner's temporary password; cleared once the owner has signed in and changed it (not tracked yet).</summary>
    public string? OwnerInitialPassword { get; set; }

    /// <summary>Secrets the stack was stamped with; kept so re-provisioning and the control calls keep working.</summary>
    public string IdentitySecret { get; set; } = "";

    public string ControlSecret { get; set; } = "";

    /// <summary>The image tag the stack runs; upgrade moves it.</summary>
    public string ImageTag { get; set; } = "latest";

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Demos only: when the stack is stopped; destroyed a week later.</summary>
    public DateTimeOffset? ExpiresAt { get; set; }

    public DateTimeOffset? ProvisionedAt { get; set; }

    public string? LastError { get; set; }

    public List<ProvisioningStep> Steps { get; set; } = [];
}

public enum StepStatus
{
    Pending = 0,
    Running = 1,
    Done = 2,
    Failed = 3,
    Skipped = 4,
}

/// <summary>One step of one provisioning (or destroy) run, so the control app can show where a tenant is and what went wrong.</summary>
public class ProvisioningStep
{
    public long Id { get; set; }

    public Guid TenantId { get; set; }

    /// <summary>The run these steps belong to; a retry starts a new run.</summary>
    public Guid RunId { get; set; }

    public string Name { get; set; } = "";

    public StepStatus Status { get; set; }

    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? FinishedAt { get; set; }

    /// <summary>What the step printed, or the error.</summary>
    public string? Output { get; set; }
}
