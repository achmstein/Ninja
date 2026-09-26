namespace Ninja.Tenant.API.Model;

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

    /// <summary>
    /// Which Arabic the apps speak: "standard" (Modern Standard Arabic) or
    /// "egyptian". Null reads as Egyptian for an Egyptian café and Standard
    /// anywhere else — what the tenant was made with before it was a choice.
    /// </summary>
    public string? ArabicStyle { get; set; }

    public string EffectiveArabicStyle => ArabicStyle ?? (Country == "EG" ? "egyptian" : "standard");

    /// <summary>
    /// What kind of place it is — "coffee_shop", "restaurant", "cloud_kitchen",
    /// "game_station" or "other" — chosen when the café was created and
    /// changeable from the control plane. It picked the starting switches and
    /// the kitchen's first station; after that the surfaces read it, and a
    /// cloud kitchen's apps leave out the tables it does not have.
    /// </summary>
    public string? BusinessType { get; set; }

    /// <summary>
    /// A guest may order without being at a table: from home, on the way, to
    /// collect at the counter. Off, a guest's order has to name the place it
    /// is carried to, and ordering ahead is for account holders. The kind of
    /// place starts it (on for a cloud kitchen); the owner switches it in admin.
    /// </summary>
    public bool GuestOrdersAnywhere { get; set; }

    /// <summary>Reservations: customers book a place ahead or hold it on the way, with or without a clock. Off for a café that only seats people.</summary>
    public bool ReservationsEnabled { get; set; } = true;

    /// <summary>Time billing: a tariff on a place, the clock, the cost line on the bill (PlayStation rooms, pool tables).</summary>
    public bool TimeBillingEnabled { get; set; } = true;

    /// <summary>Points on purchases (Loyalty).</summary>
    public bool LoyaltyEnabled { get; set; } = true;

    /// <summary>Customer tabs (Accounts): pay later, top up ahead.</summary>
    public bool TabsEnabled { get; set; } = true;

    public bool InventoryEnabled { get; set; } = true;

    public bool FinanceEnabled { get; set; } = true;

    public bool PayrollEnabled { get; set; } = true;

    /// <summary>The kitchen display and the "sent to kitchen" step on the till.</summary>
    public bool KdsEnabled { get; set; } = true;

    /// <summary>
    /// Guests pay or split the bill online through the café's own payment
    /// account. Off until the owner turns it on: it is no use before the
    /// café's payment keys are in.
    /// </summary>
    public bool OnlinePaymentsEnabled { get; set; }

    /// <summary>
    /// What the café's plan allows, set by the control plane: an owner may
    /// switch an entitled module off, never an unentitled one on. All on by
    /// default, so a stack nobody has told otherwise (the dev host, a stack
    /// stamped before plans) keeps every switch usable.
    /// </summary>
    public bool ReservationsEntitled { get; set; } = true;

    public bool TimeBillingEntitled { get; set; } = true;

    public bool LoyaltyEntitled { get; set; } = true;

    public bool TabsEntitled { get; set; } = true;

    public bool InventoryEntitled { get; set; } = true;

    public bool FinanceEntitled { get; set; } = true;

    public bool PayrollEntitled { get; set; } = true;

    public bool KdsEntitled { get; set; } = true;

    public bool OnlinePaymentsEntitled { get; set; } = true;

    public TenantFeatures Features => new(ReservationsEnabled, TimeBillingEnabled, LoyaltyEnabled, TabsEnabled, InventoryEnabled, FinanceEnabled, PayrollEnabled, KdsEnabled, OnlinePaymentsEnabled);

    public TenantFeatures Entitlements => new(ReservationsEntitled, TimeBillingEntitled, LoyaltyEntitled, TabsEntitled, InventoryEntitled, FinanceEntitled, PayrollEntitled, KdsEntitled, OnlinePaymentsEntitled);

    /// <summary>The switches as the owner asked for them, clamped to what the plan allows.</summary>
    public void ApplyFeatures(TenantFeatures requested)
    {
        var f = requested.Clamp(Entitlements);
        ReservationsEnabled = f.Reservations;
        TimeBillingEnabled = f.TimeBilling;
        LoyaltyEnabled = f.Loyalty;
        TabsEnabled = f.Tabs;
        InventoryEnabled = f.Inventory;
        FinanceEnabled = f.Finance;
        PayrollEnabled = f.Payroll;
        KdsEnabled = f.Kds;
        OnlinePaymentsEnabled = f.OnlinePayments;
    }

    /// <summary>What the plan allows from now on; whatever was switched on beyond it goes off.</summary>
    public void ApplyEntitlements(TenantFeatures entitled)
    {
        ReservationsEntitled = entitled.Reservations;
        TimeBillingEntitled = entitled.TimeBilling;
        LoyaltyEntitled = entitled.Loyalty;
        TabsEntitled = entitled.Tabs;
        InventoryEntitled = entitled.Inventory;
        FinanceEntitled = entitled.Finance;
        PayrollEntitled = entitled.Payroll;
        KdsEntitled = entitled.Kds;
        OnlinePaymentsEntitled = entitled.OnlinePayments;
        ApplyFeatures(Features);
    }

    /// <summary>How the owner's AI assistant speaks: its name, manner and language, and the café's own notes for it.</summary>
    public AssistantSettings Assistant { get; set; } = new();

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Changes whenever anything a surface renders changes; the surfaces put it on every brand URL.</summary>
    public long Version => UpdatedAt.UtcTicks;
}

/// <summary>
/// The seeds of the customer app's design, not a stylesheet: a handful of
/// colours, a corner radius and a font per script, from which every surface
/// derives its light and dark tokens the same way (text on a fill by
/// contrast, the dark scheme lifted from the light one). Colors are
/// "#rrggbb". Null means the platform's default for that seed.
/// </summary>
public class TenantTheme
{
    public static readonly string[] Radii = ["none", "sm", "md", "lg", "xl"];

    /// <summary>How tall the customer app's header is, and with it the wordmark: a wide, thin wordmark reads at "sm"; a chunky one needs "lg".</summary>
    public static readonly string[] HeaderSizes = ["sm", "md", "lg"];

    /// <summary>Latin families the surfaces know how to load.</summary>
    public static readonly string[] LatinFonts =
    [
        "Inter", "Manrope", "DM Sans", "Nunito", "Poppins", "Plus Jakarta Sans", "Playfair Display",
    ];

    /// <summary>Arabic families, likewise.</summary>
    public static readonly string[] ArabicFonts =
    [
        "Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Changa",
    ];

    /// <summary>Highlights, chips and hovers.</summary>
    public string? Accent { get; set; }

    /// <summary>The page behind everything, light scheme; its hue tints every neutral in both schemes.</summary>
    public string? Surface { get; set; }

    /// <summary>One of <see cref="Radii"/>.</summary>
    public string? Radius { get; set; }

    /// <summary>One of <see cref="HeaderSizes"/>; null is "sm".</summary>
    public string? HeaderSize { get; set; }

    /// <summary>One of <see cref="LatinFonts"/>.</summary>
    public string? FontLatin { get; set; }

    /// <summary>One of <see cref="ArabicFonts"/>.</summary>
    public string? FontArabic { get; set; }

    /// <summary>What the dark scheme must use instead of what is derived; null derives everything.</summary>
    public TenantThemeDark? Dark { get; set; }

    public static readonly string[] Modes = ["light", "dark"];

    /// <summary>
    /// Light or dark for someone who has not chosen: every app starts in it
    /// until the person picks their own. Null follows the device.
    /// </summary>
    public string? Mode { get; set; }

    /// <summary>
    /// The looks the customer apps know how to wear: each dresses the same
    /// screens differently (how an item, the categories and the header are
    /// laid out, the buttons, the surfaces, the spacing). The café's own
    /// seeds win over a style's defaults.
    /// </summary>
    public static readonly string[] Styles = ["classic", "minimal", "bold", "cozy", "night"];

    /// <summary>One of <see cref="Styles"/>; null is "classic", the look every café had before styles.</summary>
    public string? Style { get; set; }

    /// <summary>Parts the café dresses its own way instead of as the style does; null keeps the style's choice for all.</summary>
    public TenantLayout? Layout { get; set; }
}

/// <summary>
/// One choice per part of the customer app; a null part is the style's.
/// The allowed values are fixed lists, as the surfaces draw only these.
/// </summary>
public class TenantLayout
{
    public static readonly string[] MenuItems = ["row", "card", "compact", "hero"];
    public static readonly string[] CategoryStyles = ["chips", "tabs", "rail"];
    public static readonly string[] Headers = ["left", "center", "banner"];
    public static readonly string[] ButtonStyles = ["pill", "rounded", "square"];
    public static readonly string[] Surfaces = ["flat", "outlined", "shadow"];
    public static readonly string[] Densities = ["airy", "comfortable", "compact"];

    /// <summary>How an item shows on the menu: a row with a thumbnail, a photo card, text only, or a wide photo.</summary>
    public string? MenuItem { get; set; }

    /// <summary>Chips that scroll, underlined tabs, or a side list on wide screens (chips on a phone).</summary>
    public string? Categories { get; set; }

    /// <summary>The brand at the start, centred, or over the cover image.</summary>
    public string? Header { get; set; }

    public string? Buttons { get; set; }

    public string? Surface { get; set; }

    public string? Density { get; set; }

    public bool IsEmpty => (MenuItem ?? Categories ?? Header ?? Buttons ?? Surface ?? Density) is null;
}

/// <summary>
/// The owner's AI assistant as the owner wants it: the assistant (the MCP
/// server in the stack) reads these each time a chat app connects and
/// writes its brief from them. Null is the platform's default for each.
/// </summary>
public class AssistantSettings
{
    public static readonly string[] Tones = ["brief", "detailed"];
    public static readonly string[] Manners = ["friendly", "formal"];
    /// <summary>"match" answers in whatever the owner writes in.</summary>
    public static readonly string[] Languages = ["match", "en", "ar-eg", "ar"];

    public const int MaxName = 40;
    public const int MaxNotes = 1000;

    /// <summary>What the assistant calls itself; null is simply "the assistant".</summary>
    public string? Name { get; set; }

    /// <summary>One of <see cref="Tones"/>; null is brief.</summary>
    public string? Tone { get; set; }

    /// <summary>One of <see cref="Manners"/>; null is friendly.</summary>
    public string? Manner { get; set; }

    /// <summary>One of <see cref="Languages"/>; null is match.</summary>
    public string? Language { get; set; }

    /// <summary>The café's own notes for it ("we call the terrace tables T1–T4", "flag any discount over 20%").</summary>
    public string? Notes { get; set; }
}

/// <summary>The dark scheme's own seeds, for a brand whose lifted colours do not suit it.</summary>
public class TenantThemeDark
{
    public string? Primary { get; set; }

    public string? Accent { get; set; }

    /// <summary>The dark page, kept dark.</summary>
    public string? Surface { get; set; }
}

/// <summary>The nine switches, as the surfaces read them and as the plan allows them.</summary>
/// <param name="OnlinePayments">Last and defaulted: a caller older than online payments does not send it, and it stays off.</param>
public record TenantFeatures(bool Reservations, bool TimeBilling, bool Loyalty, bool Tabs, bool Inventory, bool Finance, bool Payroll, bool Kds, bool OnlinePayments = false)
{
    /// <summary>On only where both this and <paramref name="entitled"/> are.</summary>
    public TenantFeatures Clamp(TenantFeatures entitled) => new(
        Reservations && entitled.Reservations, TimeBilling && entitled.TimeBilling, Loyalty && entitled.Loyalty, Tabs && entitled.Tabs,
        Inventory && entitled.Inventory, Finance && entitled.Finance, Payroll && entitled.Payroll, Kds && entitled.Kds,
        OnlinePayments && entitled.OnlinePayments);
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

    /// <summary>A wide photo behind the header of the styles that have a banner, around 1600×600.</summary>
    public const string Cover = "cover";

    public static readonly string[] All = [Logo, LogoDark, WordmarkEn, WordmarkEnDark, WordmarkAr, WordmarkArDark, Cover];

    /// <summary>Photos rather than drawings: kept as JPEG, never trimmed.</summary>
    public static bool IsPhoto(string slot) => slot == Cover;

    public static bool IsKnown(string slot) => Array.IndexOf(All, slot) >= 0;

    /// <summary>The square marks, as opposed to the wide wordmarks.</summary>
    public static bool IsMark(string slot) => slot.StartsWith(Logo, StringComparison.Ordinal);
}
