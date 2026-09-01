#nullable enable
namespace Chillax.Ordering.API.Extensions;

/// <summary>
/// Reads the guest id the customer web app attaches to every request.
///
/// A guest has no account, so this id — generated in their browser and kept
/// only there — is what ties them to the orders they placed. It travels in a
/// header rather than the query string precisely because it is a secret:
/// query strings end up in access logs, headers do not.
/// </summary>
public static class GuestHeaderExtensions
{
    public const string HeaderName = "X-Guest-Id";

    /// <summary>Guest ids are client-generated UUIDs; anything longer is not one.</summary>
    private const int MaxLength = 64;

    /// <summary>
    /// Gets the guest id from the X-Guest-Id header, or null when it is
    /// missing, blank, or too long to be a UUID.
    /// </summary>
    public static string? GetGuestId(this HttpContext ctx)
    {
        if (!ctx.Request.Headers.TryGetValue(HeaderName, out var values))
        {
            return null;
        }

        var guestId = values.FirstOrDefault();

        return string.IsNullOrWhiteSpace(guestId) || guestId.Length > MaxLength
            ? null
            : guestId;
    }
}
