using System.Text.RegularExpressions;

namespace Ninja.ServiceDefaults;

/// <summary>
/// What a phone number looks like where the café is. One rule, read by
/// everything that checks a number: the realm's user profile (stamped by
/// the control plane), the order a guest places, and the apps, which are
/// handed the pattern with the rest of the tenant's locale rather than
/// carrying one of their own.
/// </summary>
public static class PhoneRules
{
    /// <summary>The regex a number must match, and the shape to show in the field.</summary>
    public static (string Pattern, string Placeholder) For(string? country) => country?.ToUpperInvariant() switch
    {
        "EG" => ("^01[0-9]{9}$", "01xxxxxxxxx"),
        "SA" or "AE" => ("^05[0-9]{8}$", "05xxxxxxxx"),
        // Anywhere else: an international number, with or without its plus
        _ => (@"^\+?[0-9]{7,15}$", "+xxxxxxxxxxx"),
    };

    /// <summary>Whether this is a number a café in that country would recognise.</summary>
    public static bool IsValid(string? phone, string? country) =>
        !string.IsNullOrWhiteSpace(phone) &&
        Regex.IsMatch(phone.Trim(), For(country).Pattern, RegexOptions.None, TimeSpan.FromSeconds(1));
}
