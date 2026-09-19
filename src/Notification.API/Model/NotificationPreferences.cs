namespace Ninja.Notification.API.Model;

public class NotificationPreferences
{
    public int Id { get; set; }
    public required string UserId { get; set; }
    public bool OrderStatusUpdates { get; set; } = true;
    public bool PromotionsAndOffers { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
