using System.Text.RegularExpressions;
using Ninja.Control.API.Model;

namespace Ninja.Control.API.Platform;

/// <summary>What a customer's phone number looks like in the tenant's country: the realm's registration form checks it.</summary>
public static class PhoneRules
{
    public static (string Pattern, string Placeholder) For(string country) => country.ToUpperInvariant() switch
    {
        "EG" => ("^01[0-9]{9}$", "01xxxxxxxxx"),
        "SA" or "AE" => ("^05[0-9]{8}$", "05xxxxxxxx"),
        // Anywhere else: an international number, with or without its plus
        _ => ("^\\+?[0-9]{7,15}$", "+xxxxxxxxxxx"),
    };
}

/// <summary>The locale a tenant is created with, checked and normalised; the defaults fill what the request leaves out.</summary>
public static partial class LocaleFields
{
    public static (string Country, string Currency, string TimeZone, string Language) Normalize(
        string? country, string? currency, string? timeZone, string? language, out string? error)
    {
        error = null;
        var c = string.IsNullOrWhiteSpace(country) ? TenantLocale.DefaultCountry : country.Trim().ToUpperInvariant();
        var cur = string.IsNullOrWhiteSpace(currency) ? TenantLocale.DefaultCurrency : currency.Trim().ToUpperInvariant();
        var tz = string.IsNullOrWhiteSpace(timeZone) ? TenantLocale.DefaultTimeZone : timeZone.Trim();
        var lang = string.IsNullOrWhiteSpace(language) ? TenantLocale.DefaultLanguage : language.Trim().ToLowerInvariant();

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
