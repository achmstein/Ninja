using PhoneNumbers;

namespace Ninja.ServiceDefaults;

/// <summary>
/// What a phone number is where the business is. One rule, read by
/// everything that checks a number, and the same rule the apps carry
/// (libphonenumber in each of them): a number is read against the
/// business's country however it was typed or autofilled, and kept in the
/// one international form, +201012345678 (E.164). Screens show it the local
/// way; nothing stores the local way.
/// </summary>
public static class PhoneRules
{
    private static readonly PhoneNumberUtil Util = PhoneNumberUtil.GetInstance();

    /// <summary>
    /// The loose shape Keycloak's own pages and older app builds hold a number to before the server reads
    /// it: digits in either script, with the separators and the plus people type. Whether it is a number
    /// here is <see cref="IsValid"/>'s to say, not a pattern's.
    /// </summary>
    public const string LoosePattern = @"^\+?[0-9٠-٩۰-۹ ().\-]{6,24}$";

    /// <summary>The loose pattern, and a mobile of the country as it is written there, to show in the field.</summary>
    public static (string Pattern, string Placeholder) For(string? country)
    {
        var region = Region(country);
        var example = region is null ? null : Util.GetExampleNumberForType(region, PhoneNumberType.MOBILE);
        return (LoosePattern, example is null ? "+xxxxxxxxxxx" : Util.Format(example, PhoneNumberFormat.NATIONAL));
    }

    /// <summary>
    /// Whether this is a customer's number here: a real number of the business's country that a mobile
    /// can have, in any spelling. A landline or a number from abroad is not.
    /// </summary>
    public static bool IsValid(string? phone, string? country) =>
        TryRead(phone, country, out var number) && IsCustomerNumber(number, country);

    /// <summary>
    /// A number as a cashier, a customer or an autofill gives it, in the one form it is kept in, so two
    /// spellings of the same phone compare equal: +201012345678 for 010 1234 5678, 1012345678,
    /// +20 10 1234 5678, 0020…, +020…, ٠١٠…. When it is not a customer's number here, what was typed
    /// with its separators dropped, which then fails <see cref="IsValid"/>. Empty when nothing
    /// number-like was typed.
    /// </summary>
    public static string Normalize(string? phone, string? country) =>
        TryRead(phone, country, out var number) && IsCustomerNumber(number, country)
            ? Util.Format(number, PhoneNumberFormat.E164)
            : Clean(phone).Text;

    /// <summary>
    /// A phone typed into a field that takes any phone (a supplier's, a branch's, a member of staff's):
    /// kept in the international form when it is a real number, a landline or one from abroad included,
    /// but never refused, since a hotline's short number is a phone too. Kept as typed when it holds no
    /// digits; null when empty.
    /// </summary>
    public static string? Tidy(string? phone, string? country)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        if (TryRead(phone, country, out var number)) return Util.Format(number, PhoneNumberFormat.E164);
        var cleaned = Clean(phone).Text;
        return cleaned.Length > 0 ? cleaned : phone.Trim();
    }

    /// <summary>
    /// A stored number as people here write it: 010 1234 5678 for one of the business's country,
    /// +44 7700 900123 for one from abroad. What is not a number is shown as it is.
    /// </summary>
    public static string? National(string? phone, string? country)
    {
        if (string.IsNullOrWhiteSpace(phone)) return phone;
        if (!TryRead(phone, country, out var number)) return phone.Trim();
        var home = Region(country);
        return Util.Format(number, home is not null && Util.GetRegionCodeForNumber(number) == home
            ? PhoneNumberFormat.NATIONAL
            : PhoneNumberFormat.INTERNATIONAL);
    }

    /// <summary>
    /// The digits a search may be typed as, for a stored number: the international ones and the local
    /// ones, a space between, so "0101" and "20101" both find +201012345678. Just its digits when it is
    /// not a number.
    /// </summary>
    public static string SearchDigits(string? phone, string? country)
    {
        var (_, digits, _) = Clean(phone);
        if (digits.Length == 0 || !TryRead(phone, country, out var number)) return digits;
        var local = new string(Util.Format(number, PhoneNumberFormat.NATIONAL).Where(char.IsAsciiDigit).ToArray());
        var international = $"{number.CountryCode}{Util.GetNationalSignificantNumber(number)}";
        return $"{international} {local}";
    }

    /// <summary>
    /// The number the text spells, when it spells a real one: read against the business's country, or
    /// against its own country code when it carries one.
    /// </summary>
    private static bool TryRead(string? phone, string? country, out PhoneNumber number)
    {
        number = new PhoneNumber();
        var (plus, digits, _) = Clean(phone);
        if (digits.Length == 0) return false;

        var region = Region(country);
        // +020…, as some forms and contact books write +20: no country code starts with a zero
        if (plus) digits = digits.TrimStart('0');
        if (TryParseValid(plus ? $"+{digits}" : digits, region, out number)) return true;

        // +20 010…, 20 10…: the country's own code in front of a number written the local way
        if (region is not null)
        {
            var code = Util.GetCountryCodeForRegion(region).ToString();
            if (digits.Length > code.Length && digits.StartsWith(code, StringComparison.Ordinal)
                && TryParseValid(digits[code.Length..], region, out number))
            {
                return true;
            }
        }
        return false;
    }

    private static bool TryParseValid(string text, string? region, out PhoneNumber number)
    {
        number = new PhoneNumber();
        if (region is null && !text.StartsWith('+')) return false;
        try
        {
            number = Util.Parse(text, region);
            return Util.IsValidNumber(number);
        }
        catch (NumberParseException)
        {
            return false;
        }
    }

    private static bool IsCustomerNumber(PhoneNumber number, string? country)
    {
        var region = Region(country);
        if (region is not null && !Util.IsValidNumberForRegion(number, region)) return false;
        return Util.GetNumberType(number) is PhoneNumberType.MOBILE or PhoneNumberType.FIXED_LINE_OR_MOBILE;
    }

    /// <summary>The country as the library knows it, or null for one it does not.</summary>
    private static string? Region(string? country)
    {
        var region = country?.Trim().ToUpperInvariant();
        return region is not null && Util.GetSupportedRegions().Contains(region) ? region : null;
    }

    /// <summary>
    /// The text with only what a number is made of: Arabic-Indic digits read as 0-9, spaces, dashes,
    /// dots and brackets dropped, a leading plus kept and a 00 prefix read as one.
    /// </summary>
    private static (bool Plus, string Digits, string Text) Clean(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return (false, string.Empty, string.Empty);

        var plus = false;
        var digits = new System.Text.StringBuilder(phone.Length);
        foreach (var ch in phone.Trim())
        {
            if (ch is >= '0' and <= '9') digits.Append(ch);
            else if (ch is >= '٠' and <= '٩') digits.Append((char)('0' + (ch - '٠')));
            else if (ch is >= '۰' and <= '۹') digits.Append((char)('0' + (ch - '۰')));
            else if ((ch == '+' || ch == '＋') && digits.Length == 0) plus = true;
        }
        var number = digits.ToString();
        if (number.Length == 0) return (false, string.Empty, string.Empty);
        if (!plus && number.StartsWith("00", StringComparison.Ordinal))
        {
            plus = true;
            number = number[2..];
        }
        return (plus, number, plus ? $"+{number}" : number);
    }
}
