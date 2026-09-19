namespace Ninja.Notification.API.Model;

public class NotificationSubscription
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public required string FcmToken { get; set; }
    public SubscriptionType Type { get; set; }
    public int? BranchId { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum SubscriptionType
{
    RoomAvailability = 1,
    AdminOrderNotification = 2,
    ServiceRequests = 3,
    AdminReservationNotification = 4,
    UserOrderNotification = 5,
    UserSessionNotification = 6
}
