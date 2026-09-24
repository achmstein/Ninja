using System.Text.RegularExpressions;
using Ninja.Control.API.Model;
using Ninja.ServiceDefaults;

namespace Ninja.Control.API.Platform;

/// <summary>The locale a tenant is created with, checked and normalised; what the request leaves out follows its country.</summary>
public static partial class LocaleFields
{
    /// <summary>What a country implies when nothing else is said: its money, its clock, its first language.</summary>
    private static readonly Dictionary<string, (string Currency, string TimeZone, string Language)> ByCountry = new()
    {
        ["EG"] = ("EGP", "Africa/Cairo", "ar"),
        ["SA"] = ("SAR", "Asia/Riyadh", "ar"),
        ["AE"] = ("AED", "Asia/Dubai", "ar"),
        ["KW"] = ("KWD", "Asia/Kuwait", "ar"),
        ["QA"] = ("QAR", "Asia/Qatar", "ar"),
        ["BH"] = ("BHD", "Asia/Bahrain", "ar"),
        ["OM"] = ("OMR", "Asia/Muscat", "ar"),
        ["JO"] = ("JOD", "Asia/Amman", "ar"),
        ["LB"] = ("LBP", "Asia/Beirut", "ar"),
        ["IQ"] = ("IQD", "Asia/Baghdad", "ar"),
        ["MA"] = ("MAD", "Africa/Casablanca", "ar"),
        ["TN"] = ("TND", "Africa/Tunis", "ar"),
        ["DZ"] = ("DZD", "Africa/Algiers", "ar"),
        ["LY"] = ("LYD", "Africa/Tripoli", "ar"),
        ["SD"] = ("SDG", "Africa/Khartoum", "ar"),
        ["TR"] = ("TRY", "Europe/Istanbul", "en"),
        ["GB"] = ("GBP", "Europe/London", "en"),
        ["DE"] = ("EUR", "Europe/Berlin", "en"),
        ["FR"] = ("EUR", "Europe/Paris", "en"),
        ["US"] = ("USD", "America/New_York", "en"),
        ["CA"] = ("CAD", "America/Toronto", "en"),
    };

    public static (string Country, string Currency, string TimeZone, string Language) Normalize(
        string? country, string? currency, string? timeZone, string? language, out string? error)
    {
        error = null;
        var c = string.IsNullOrWhiteSpace(country) ? TenantLocale.DefaultCountry : country.Trim().ToUpperInvariant();
        if (!ByCountry.TryGetValue(c, out var implied))
            implied = (TenantLocale.DefaultCurrency, TenantLocale.DefaultTimeZone, TenantLocale.DefaultLanguage);
        var cur = string.IsNullOrWhiteSpace(currency) ? implied.Currency : currency.Trim().ToUpperInvariant();
        var tz = string.IsNullOrWhiteSpace(timeZone) ? implied.TimeZone : timeZone.Trim();
        var lang = string.IsNullOrWhiteSpace(language) ? implied.Language : language.Trim().ToLowerInvariant();

        if (!Alpha2().IsMatch(c)) error = "The country must be an ISO 3166-1 alpha-2 code.";
        else if (!Alpha3().IsMatch(cur)) error = "The currency must be an ISO 4217 code.";
        else if (!TimeZoneInfo.TryFindSystemTimeZoneById(tz, out _)) error = $"'{tz}' is not a time zone this platform knows.";
        else if (!TenantLocale.Languages.Contains(lang)) error = "The language must be ar or en.";

        return (c, cur, tz, lang);
    }

    [GeneratedRegex("^[A-Z]{2}$")]
    private static partial Regex Alpha2();

    [GeneratedRegex("^[A-Z]{3}$")]
    private static partial Regex Alpha3();
}
