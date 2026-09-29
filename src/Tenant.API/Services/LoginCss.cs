using System.Globalization;
using System.Text.RegularExpressions;

namespace Ninja.Tenant.API.Services;

/// <summary>
/// The café's colours and fonts for its sign-in pages. One Keycloak theme
/// serves every café, in the platform's palette; the theme loads this beside
/// its own stylesheet, from the API host its header mark already comes from,
/// so the buttons and the focus ring wear the café's colour as its apps do,
/// and the customer's pages (drawn as the app) its fonts. No colours for a
/// café that keeps the neutral palette; no fonts for one that chose none.
/// </summary>
public static partial class LoginCss
{
    public static string For(Model.Tenant tenant) => Fonts(tenant) + Colours(tenant);

    /// <summary>
    /// The café's chosen families (only names from its lists reach this sheet), loaded from where
    /// each is served, as --font-latin / --font-arabic for the customer's pages; nothing when it
    /// chose none, the theme falling back to the app's own
    /// </summary>
    public static string Fonts(Model.Tenant tenant)
    {
        var latin = Model.TenantTheme.KnownFont(tenant.Theme?.FontLatin, Model.TenantTheme.LatinFonts);
        var arabic = Model.TenantTheme.KnownFont(tenant.Theme?.FontArabic, Model.TenantTheme.ArabicFonts);
        if (latin is null && arabic is null) return "";
        var css = new System.Text.StringBuilder();
        // An @import must come before any rule in the sheet
        foreach (var family in new[] { latin, arabic }.OfType<string>())
            css.Append($"@import url('{FontUrl(family)}');\n");
        css.Append(":root {\n");
        if (latin is not null) css.Append($"  --font-latin: '{latin}';\n");
        if (arabic is not null) css.Append($"  --font-arabic: '{arabic}';\n");
        css.Append("}\n");
        return css.ToString();
    }

    /// <summary>The stylesheet a family is served by: Fontshare's two, Google's the rest</summary>
    public static string FontUrl(string family) => family switch
    {
        "Satoshi" => "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap",
        "General Sans" => "https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap",
        _ => $"https://fonts.googleapis.com/css2?family={family.Replace(' ', '+')}:wght@400;500;600;700;800&display=swap",
    };

    private static string Colours(Model.Tenant tenant)
    {
        var light = Hex(tenant.PrimaryColor);
        if (light is null) return "/* The neutral palette: nothing to change */\n";
        var dark = Hex(tenant.Theme?.Dark?.Primary) ?? light;
        return $$"""
            /* The café's colours on its sign-in pages (only #rrggbb values reach this sheet) */
            :root {
            {{Tokens(light)}}}
            :root[data-theme='dark'] {
            {{Tokens(dark)}}}
            @media (prefers-color-scheme: dark) {
              :root:not([data-theme]) {
            {{Tokens(dark)}}  }
            }

            """;
    }

    private static string Tokens(string hex)
        => $"""
              --primary: {hex};
              --primary-foreground: {OnColour(hex)};
              --ring: color-mix(in oklch, {hex} 60%, transparent);

            """;

    /// <summary>White or near-black, whichever reads on the colour (WCAG's relative luminance).</summary>
    public static string OnColour(string hex)
    {
        static double Channel(string hex, int at)
        {
            var c = int.Parse(hex.AsSpan(at, 2), NumberStyles.HexNumber) / 255.0;
            return c <= 0.03928 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
        }
        var luminance = 0.2126 * Channel(hex, 1) + 0.7152 * Channel(hex, 3) + 0.0722 * Channel(hex, 5);
        // Against white (1.05) or against near-black (#0a0a0a, about 0.053), whichever is the stronger
        return (1.05 / (luminance + 0.05)) >= ((luminance + 0.05) / 0.053) ? "#ffffff" : "#0a0a0a";
    }

    /// <summary>A #rrggbb colour, lower-cased; null for anything else (never written into the sheet)</summary>
    private static string? Hex(string? value)
        => value is not null && HexColor().IsMatch(value.Trim()) ? value.Trim().ToLowerInvariant() : null;

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();
}
