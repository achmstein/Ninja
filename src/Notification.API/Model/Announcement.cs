namespace Chillax.Notification.API.Model;

/// <summary>
/// A broadcast push notification sent by staff to all opted-in customers.
/// </summary>
public class Announcement
{
    public int Id { get; set; }
    public required string Title { get; set; }
    public required string Body { get; set; }
    public required string SentBy { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public int RecipientCount { get; set; }
}
