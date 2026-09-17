#nullable enable
namespace Chillax.Sales.API.Extensions;

/// <summary>
/// Reads the guest id the customer web app attaches to every request — the
/// same header Ordering and Notification read. A guest has no account, so
/// this id is what ties them to the lines they ordered on a bill.
/// </summary>
public static class GuestHeaderExtensions
{
    public const string HeaderName = "X-Guest-Id";

    /// <summary>Guest ids are client-generated UUIDs; anything longer is not one.</summary>
    private const int MaxLength = 64;

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
