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

    /// <summary>
    /// A number as a cashier or a customer types it, in the one form the
    /// country's pattern expects, so two spellings of the same phone compare
    /// equal: Arabic-Indic digits read as 0-9, spaces, dashes, dots and
    /// brackets dropped, a 00 prefix read as +, and the country's own code
    /// (+20, +966, +971) or a missing trunk 0 turned back into the local
    /// 0-prefixed number. Anywhere else an international number keeps its
    /// plus. Empty when nothing number-like was typed; the result may still
    /// fail <see cref="IsValid"/> (too short, not a mobile).
    /// </summary>
    public static string Normalize(string? phone, string? country)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;

        var plus = false;
        var digits = new System.Text.StringBuilder(phone.Length);
        foreach (var ch in phone.Trim())
        {
            if (ch is >= '0' and <= '9') digits.Append(ch);
            else if (ch is >= '٠' and <= '٩') digits.Append((char)('0' + (ch - '٠'))); // ٠-٩
            else if (ch is >= '۰' and <= '۹') digits.Append((char)('0' + (ch - '۰'))); // ۰-۹
            else if ((ch == '+' || ch == '＋') && digits.Length == 0) plus = true;
        }
        var number = digits.ToString();
        if (number.Length == 0) return string.Empty;
        if (!plus && number.StartsWith("00", StringComparison.Ordinal))
        {
            plus = true;
            number = number[2..];
        }

        var (code, localLength, mobileStart) = country?.ToUpperInvariant() switch
        {
            "EG" => ("20", 10, '1'),
            "SA" => ("966", 9, '5'),
            "AE" => ("971", 9, '5'),
            _ => ((string?)null, 0, '\0'),
        };
        if (code is null)
        {
            return plus ? $"+{number}" : number;
        }

        // +20 10…, 20 10…, +20 010… → 010…
        if (number.StartsWith(code, StringComparison.Ordinal) && (plus || number.Length >= code.Length + localLength))
        {
            var rest = number[code.Length..];
            if (rest.StartsWith('0')) rest = rest[1..];
            return $"0{rest}";
        }
        // 10… typed without its trunk zero
        if (!plus && number.Length == localLength && number[0] == mobileStart)
        {
            return $"0{number}";
        }
        return plus ? $"+{number}" : number;
    }
}
