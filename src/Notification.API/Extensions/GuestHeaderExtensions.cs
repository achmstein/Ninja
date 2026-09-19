#nullable enable
namespace Ninja.Notification.API.Extensions;

/// <summary>
/// Reads the guest id the customer web app attaches to every request — the
/// same header Ordering reads. A guest at a table has no account; this id,
/// generated in their browser and kept only there, is what lets them call a
/// waiter or ask for the bill without signing in. Services share no code, so
/// the few lines are repeated here rather than referenced.
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
