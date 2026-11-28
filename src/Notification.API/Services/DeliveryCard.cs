using Ninja.Notification.API.Model;

namespace Ninja.Notification.API.Services;

/// <summary>
/// The customer's live delivery card: one notification on their phone for
/// the whole delivery, drawn and updated by the app itself from a data-only
/// message. A phone is sent it only when its app said which platform it is
/// (<see cref="NotificationSubscription.Platform"/>): an older build says
/// nothing and keeps getting the plain pushes. Carries where the delivery has
/// got to and who to ring, never a point on the map.
/// </summary>
public static class DeliveryCard
{
    /// <summary>The data message's type, as the apps route it.</summary>
    public const string MessageType = "delivery_card";

    public const string Android = "android";
    public const string Ios = "ios";

    /// <summary>The platform as kept: "android", "ios", or null for anything else (an older build sends none).</summary>
    public static string? PlatformOf(string? sent) => sent?.Trim().ToLowerInvariant() switch
    {
        Android => Android,
        Ios => Ios,
        _ => null,
    };

    /// <summary>The app on this phone draws the card.</summary>
    public static bool HasCard(NotificationSubscription subscription) => subscription.Platform is Android or Ios;

    /// <summary>
    /// A step of the delivery, whole: every field is said, an empty one as "", so the card drops what
    /// no longer holds (the rider's number once it is handed over).
    /// </summary>
    /// <param name="alert">The card rings for this one: it left, the rider is near, or it could not be delivered.</param>
    public static Dictionary<string, string> Step(
        int orderId, DeliveryStage stage, int version, int? progress, int? etaMinutes, string? riderName, string? riderPhone,
        bool nearby, bool coming, string? failureReason, bool alert) => new()
    {
        ["type"] = MessageType,
        ["orderId"] = orderId.ToString(),
        ["stage"] = stage.ToString(),
        ["version"] = version.ToString(),
        ["progress"] = progress?.ToString() ?? string.Empty,
        ["etaMinutes"] = etaMinutes?.ToString() ?? string.Empty,
        ["riderName"] = riderName ?? string.Empty,
        ["riderPhone"] = riderPhone ?? string.Empty,
        ["nearby"] = nearby ? "1" : "0",
        ["coming"] = coming ? "1" : "0",
        ["failureReason"] = failureReason ?? string.Empty,
        ["alert"] = alert ? "1" : "0",
    };

    /// <summary>The rider got closer: only what moved is said, and the card keeps the rest as it has it.</summary>
    public static Dictionary<string, string> Progress(int orderId, int version, int progress, int? etaMinutes)
    {
        var data = new Dictionary<string, string>
        {
            ["type"] = MessageType,
            ["orderId"] = orderId.ToString(),
            ["stage"] = nameof(DeliveryStage.OnTheWay),
            ["version"] = version.ToString(),
            ["progress"] = progress.ToString(),
            ["alert"] = "0",
        };
        if (etaMinutes is { } minutes) data["etaMinutes"] = minutes.ToString();
        return data;
    }
}
