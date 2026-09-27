using System.Globalization;
using System.Text.RegularExpressions;

namespace Ninja.Tenant.API.Services;

/// <summary>
/// The café's colours for its sign-in pages. One Keycloak theme serves every
/// café, in the platform's palette; the theme loads this beside its own
/// stylesheet, from the API host its header mark already comes from, so the
/// buttons and the focus ring wear the café's colour as its apps do. Nothing
/// (an empty sheet) for a café that keeps the neutral palette.
/// </summary>
public static partial class LoginCss
{
    public static string For(Model.Tenant tenant)
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
