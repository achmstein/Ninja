namespace Chillax.Notification.API.Model;

public class ServiceRequest
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    /// <summary>The room session the request came from; null for a table.</summary>
    public int? SessionId { get; set; }
    public int? RoomId { get; set; }
    public int BranchId { get; set; }
    /// <summary>The place the till goes to: the room, or the table's name for a table request.</summary>
    public LocalizedText RoomName { get; set; } = new LocalizedText(string.Empty);
    /// <summary>The table the request came from; null for a room.</summary>
    public int? TableId { get; set; }
    public LocalizedText? TableName { get; set; }
    public ServiceRequestType RequestType { get; set; }
    public ServiceRequestStatus Status { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }
}

public enum ServiceRequestType
{
    CallWaiter = 1,
    ControllerChange = 2,
    ReceiptToPay = 3,
    SwitchToMulti = 4,
    SwitchToSingle = 5
}

public enum ServiceRequestStatus
{
    Pending = 1,
    Acknowledged = 2,
    Completed = 3
}
