using System.Globalization;
using System.Text.RegularExpressions;

namespace Ninja.ServiceDefaults;

/// <summary>A point on the map, in degrees.</summary>
public readonly record struct GeoPoint(double Latitude, double Longitude);

/// <summary>
/// Where a place is, read from what someone pastes (an owner their branch, a
/// cashier the location a caller shared): its Google Maps link
/// (long or short, a pin or a place) or plain coordinates ("30.0444, 31.2357").
/// A short link is followed to the long one it stands for, then read.
/// </summary>
public static partial class MapLocation
{
    /// <summary>The coordinates a pasted link or text names, or null when it names none.</summary>
    public static GeoPoint? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var value = Uri.UnescapeDataString(text.Trim());

        // A place's own pin, which is where the branch is, wins over the map's centre
        foreach (var regex in new[] { PlacePin(), AtCentre(), QueryPair(), PlainPair() })
        {
            var match = regex.Match(value);
            if (match.Success && Point(match.Groups["lat"].Value, match.Groups["lng"].Value) is { } point)
                return point;
        }
        return null;
    }

    /// <summary>True for a link that only redirects to the map (maps.app.goo.gl, goo.gl/maps).</summary>
    public static bool IsShortLink(string? text) =>
        Uri.TryCreate(text?.Trim(), UriKind.Absolute, out var uri)
        && (uri.Host.Equals("maps.app.goo.gl", StringComparison.OrdinalIgnoreCase)
            || (uri.Host.Equals("goo.gl", StringComparison.OrdinalIgnoreCase) && uri.AbsolutePath.StartsWith("/maps", StringComparison.OrdinalIgnoreCase)));

    /// <summary>
    /// The coordinates of what was pasted, following a short link to the map it
    /// opens; null when there are none to read.
    /// </summary>
    public static async Task<GeoPoint?> ResolveAsync(string? text, HttpClient http, CancellationToken ct)
    {
        if (Parse(text) is { } direct) return direct;
        if (!IsShortLink(text)) return null;

        try
        {
            using var response = await http.GetAsync(text!.Trim(), HttpCompletionOption.ResponseHeadersRead, ct);
            var final = response.RequestMessage?.RequestUri?.ToString();
            return Parse(final);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return null;
        }
    }

    private static GeoPoint? Point(string lat, string lng)
    {
        if (!double.TryParse(lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var la)
            || !double.TryParse(lng, NumberStyles.Float, CultureInfo.InvariantCulture, out var lo))
            return null;
        if (la is < -90 or > 90 || lo is < -180 or > 180 || (la == 0 && lo == 0)) return null;
        return new GeoPoint(Math.Round(la, 6), Math.Round(lo, 6));
    }

    private const string Number = @"-?\d{1,3}(?:\.\d+)?";

    /// <summary>A place's pin in a long link: !3d30.04!4d31.23</summary>
    [GeneratedRegex(@"!3d(?<lat>" + Number + @")!4d(?<lng>" + Number + ")")]
    private static partial Regex PlacePin();

    /// <summary>The map's centre in a long link: /@30.04,31.23,17z</summary>
    [GeneratedRegex(@"@(?<lat>" + Number + @"),(?<lng>" + Number + ")")]
    private static partial Regex AtCentre();

    /// <summary>A point in the query: ?q=30.04,31.23 (also query=, ll=, destination=)</summary>
    [GeneratedRegex(@"[?&](?:q|query|ll|destination|daddr)=(?:loc:)?(?<lat>" + Number + @")\s*,\s*(?<lng>" + Number + ")")]
    private static partial Regex QueryPair();

    /// <summary>Coordinates as plain text: 30.0444, 31.2357</summary>
    [GeneratedRegex(@"^\s*(?<lat>" + Number + @")\s*,\s*(?<lng>" + Number + @")\s*$")]
    private static partial Regex PlainPair();
}
