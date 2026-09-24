namespace Ninja.Notification.API.Localization;

/// <summary>
/// Which Arabic this cafe speaks. Notification.API runs one container per
/// tenant, so the style arrives as configuration (Tenant__ArabicStyle) the
/// control plane stamps beside the rest of the tenant's locale. The rule
/// for an unset style is Branch.API's: Egypt speaks Egyptian, everywhere
/// else speaks Standard.
/// </summary>
public sealed class TenantArabic
{
    public TenantArabic(IConfiguration configuration)
    {
        var style = configuration["Tenant:ArabicStyle"];
        if (string.IsNullOrWhiteSpace(style))
        {
            style = string.Equals(configuration["Tenant:Country"], "EG", StringComparison.OrdinalIgnoreCase)
                ? "egyptian"
                : "standard";
        }

        Standard = !string.Equals(style.Trim(), "egyptian", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>True when the cafe reads Modern Standard Arabic.</summary>
    public bool Standard { get; }
}
