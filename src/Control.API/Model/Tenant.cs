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
    /// <summary>The stack is being re-stamped and restarted (secure, rotate, upgrade); back to Running or Failed within minutes.</summary>
    Upgrading = 7,
    /// <summary>Stopped for non-payment; comes back with a payment or a resume, never a plain start.</summary>
    Suspended = 8,
}

/// <summary>Where the café stands with its subscription; the stack's own status is separate (a PastDue café keeps running until its grace is over).</summary>
public enum SubscriptionStatus
{
    /// <summary>A demo.</summary>
    Trialing = 0,
    Active = 1,
    /// <summary>Past its paid period, inside the grace days.</summary>
    PastDue = 2,
    /// <summary>Grace over, or suspended by hand: the stack is stopped.</summary>
    Suspended = 3,
    Cancelled = 4,
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

    /// <summary>Modules bought on top of the plan (Platform.PlanCatalog says what each plan includes and what may be added).</summary>
    public Platform.Module[] Addons { get; set; } = [];

    public SubscriptionStatus Subscription { get; set; } = SubscriptionStatus.Active;

    /// <summary>Customers: the day the last recorded payment covers; null means nobody is counting yet.</summary>
    public DateTimeOffset? PaidThrough { get; set; }

    /// <summary>Days past PaidThrough before the stack is suspended; null takes the platform's default.</summary>
    public int? GraceDays { get; set; }

    public DateTimeOffset? SuspendedAt { get; set; }

    /// <summary>When the owner was told the subscription is past due; cleared by a payment.</summary>
    public DateTimeOffset? PastDueNotifiedAt { get; set; }

    public List<Payment> Payments { get; set; } = [];

    public string? Notes { get; set; }

    /// <summary>A scratch tenant the restore drill stamps and destroys: nobody is mailed about it and the demo sweep leaves it alone.</summary>
    public bool IsDrill { get; set; }

    /// <summary>The first owner's temporary password; cleared once the owner has signed in and changed it (not tracked yet).</summary>
    public string? OwnerInitialPassword { get; set; }

    /// <summary>Secrets the stack was stamped with; kept so re-provisioning and the control calls keep working.</summary>
    public string IdentitySecret { get; set; } = "";

    public string ControlSecret { get; set; } = "";

    /// <summary>The realm's assistant-api client secret: the owner's MCP server exchanges chat-app tokens with it. Filled by the credentials step for stacks stamped before there was one.</summary>
    public string AssistantSecret { get; set; } = "";

    /// <summary>
    /// The stack's own database role and broker user passwords ({slug}_app on
    /// both). Null while the stack still runs on the shared credentials it was
    /// stamped with before there were any of its own; the credentials step
    /// fills them on the next provision, secure or upgrade.
    /// </summary>
    public string? DbPassword { get; set; }

    public string? BrokerPassword { get; set; }

    public bool HasOwnCredentials => DbPassword is not null && BrokerPassword is not null;

    /// <summary>The image tag the stack runs; upgrade moves it.</summary>
    public string ImageTag { get; set; } = "latest";

    /// <summary>The tag the stack ran before the last upgrade: what a rollback goes back to. Null until the first upgrade on this build.</summary>
    public string? PreviousImageTag { get; set; }

    /// <summary>The backup taken (or reused) right before the last upgrade: what to restore if a rollback has to cross a migration.</summary>
    public string? UpgradeBackupId { get; set; }

    /// <summary>"{slug}/{backupId}" while a stamp is to load another tenant's backup into this one; cleared once it has.</summary>
    public string? RestoreFrom { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Demos only: when the stack is stopped; destroyed a week later.</summary>
    public DateTimeOffset? ExpiresAt { get; set; }

    public DateTimeOffset? ProvisionedAt { get; set; }

    /// <summary>When the owner's welcome mail went out (once per tenant; resent by hand from the control app).</summary>
    public DateTimeOffset? WelcomeSentAt { get; set; }

    /// <summary>Demos: when the owner was told the demo is about to stop, and when that it is about to be deleted; cleared by an extension.</summary>
    public DateTimeOffset? ExpiryWarnedAt { get; set; }

    public DateTimeOffset? DestroyWarnedAt { get; set; }

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
