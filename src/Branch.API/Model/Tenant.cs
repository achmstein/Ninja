namespace Ninja.Branch.API.Model;

/// <summary>
/// The business this stack runs for: its name, its look and which parts of
/// the platform it has switched on. One row per stack (<see cref="SingletonId"/>);
/// a new tenant is a new stack, not a new row (ninja-plan.md D2). The logo
/// itself lives on disk (<see cref="Services.TenantBrandStore"/>); the row
/// only remembers whether there is one and when it last changed.
/// </summary>
public class Tenant
{
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    public LocalizedText Name { get; set; } = new();

    /// <summary>The brand color as "#rrggbb"; the surfaces derive their palettes from it. Null keeps the platform's neutral look.</summary>
    public string? PrimaryColor { get; set; }

    /// <summary>
    /// Where customers open the menu ("https://app.example.com"): the printed
    /// QR codes and the share links point here. Set by provisioning; null
    /// until then, and the surfaces fall back to their own origin.
    /// </summary>
    public string? CustomerUrl { get; set; }

    /// <summary>
    /// The uploaded images by slot (<see cref="TenantImageSlots"/>): the square
    /// mark and the wordmarks per language and scheme. A slot that is absent
    /// falls back on the surfaces (dark → light, Arabic → English); the icons
    /// are always cut from <see cref="TenantImageSlots.Logo"/>.
    /// </summary>
    public Dictionary<string, TenantImage> Images { get; set; } = new();

    public bool HasLogo => Images.ContainsKey(TenantImageSlots.Logo);

    public TenantImage? Image(string slot) => Images.GetValueOrDefault(slot);

    /// <summary>The customer app's look beyond the primary color; every field optional, the platform's default when null.</summary>
    public TenantTheme Theme { get; set; } = new();

    /// <summary>ISO 3166-1 alpha-2, the café's country.</summary>
    public string Country { get; set; } = "EG";

    /// <summary>ISO 4217, what every price is shown in.</summary>
    public string Currency { get; set; } = "EGP";

    /// <summary>IANA zone, the café's clock (the services read it from their own configuration; this is what the surfaces see).</summary>
    public string TimeZone { get; set; } = "Africa/Cairo";

    /// <summary>"ar" or "en": what the customer app opens in.</summary>
    public string DefaultLanguage { get; set; } = "ar";

    /// <summary>Rooms and their time billing (Spaces). Off for a café that only has tables.</summary>
    public bool RoomsEnabled { get; set; } = true;

    /// <summary>Points on purchases (Loyalty).</summary>
    public bool LoyaltyEnabled { get; set; } = true;

    /// <summary>Customer tabs (Accounts): pay later, top up ahead.</summary>
    public bool TabsEnabled { get; set; } = true;

    public bool InventoryEnabled { get; set; } = true;

    public bool FinanceEnabled { get; set; } = true;

    public bool PayrollEnabled { get; set; } = true;

    /// <summary>The kitchen display and the "sent to kitchen" step on the till.</summary>
    public bool KdsEnabled { get; set; } = true;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Changes whenever anything a surface renders changes; the surfaces put it on every brand URL.</summary>
    public long Version => UpdatedAt.UtcTicks;
}

/// <summary>
/// A handful of tokens, not a stylesheet: enough to make the customer app
/// look like the café's design without a build per client. Colors are
/// "#rrggbb"; the light scheme takes them as given and the dark scheme is
/// derived. Null means the platform's default for that token.
/// </summary>
public class TenantTheme
{
    public static readonly string[] Radii = ["none", "sm", "md", "lg", "xl"];

    /// <summary>Latin families the surfaces know how to load; Arabic always falls back to Cairo.</summary>
    public static readonly string[] Fonts =
    [
        "Inter", "Manrope", "DM Sans", "Nunito", "Poppins", "Plus Jakarta Sans", "Playfair Display", "Cairo", "Tajawal", "Almarai",
    ];

    /// <summary>Highlights, chips and hovers.</summary>
    public string? Accent { get; set; }

    /// <summary>The page behind everything, light scheme.</summary>
    public string? Background { get; set; }

    /// <summary>Text on that page, light scheme.</summary>
    public string? Foreground { get; set; }

    /// <summary>One of <see cref="Radii"/>.</summary>
    public string? Radius { get; set; }

    /// <summary>One of <see cref="Fonts"/>.</summary>
    public string? Font { get; set; }
}

/// <summary>One uploaded image: when it last changed (ticks, the cache key of its URL) and its size after trimming, so a surface can reserve the box.</summary>
public sealed class TenantImage
{
    public long Version { get; set; }

    public int Width { get; set; }

    public int Height { get; set; }
}

/// <summary>
/// The images a brand is made of. The mark is square and language-neutral;
/// a wordmark is the wide lockup with the name, one per language, each with
/// an optional dark-scheme version.
/// </summary>
public static class TenantImageSlots
{
    public const string Logo = "logo";
    public const string LogoDark = "logo-dark";
    public const string WordmarkEn = "wordmark-en";
    public const string WordmarkEnDark = "wordmark-en-dark";
    public const string WordmarkAr = "wordmark-ar";
    public const string WordmarkArDark = "wordmark-ar-dark";

    public static readonly string[] All = [Logo, LogoDark, WordmarkEn, WordmarkEnDark, WordmarkAr, WordmarkArDark];

    public static bool IsKnown(string slot) => Array.IndexOf(All, slot) >= 0;

    /// <summary>The square marks, as opposed to the wide wordmarks.</summary>
    public static bool IsMark(string slot) => slot.StartsWith(Logo, StringComparison.Ordinal);
}
