namespace Ninja.Notification.API.Model;

public class ServiceRequest
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    /// <summary>The stay the request came from; null when no clock runs at the place.</summary>
    public int? SessionId { get; set; }
    /// <summary>The Spaces place the request came from.</summary>
    public int? PlaceId { get; set; }
    /// <summary>"Room", "Table" or "Station".</summary>
    public string? PlaceKind { get; set; }
    /// <summary>The place's name as the request named it: where the till goes.</summary>
    public LocalizedText PlaceName { get; set; } = new LocalizedText(string.Empty);
    /// <summary>The rate option asked for by a <see cref="ServiceRequestType.ChangeOption"/> request ("multi", "single", ...).</summary>
    public string? OptionCode { get; set; }
    public int BranchId { get; set; }
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
    // 4 and 5 were the two-option room switches, now a ChangeOption with the option's code
    /// <summary>Switch the stay to another rate option of the place's tariff; the option travels in OptionCode.</summary>
    ChangeOption = 6,
}

public enum ServiceRequestStatus
{
    Pending = 1,
    Acknowledged = 2,
    Completed = 3,
    /// <summary>Taken back by the customer before anyone picked it up.</summary>
    Cancelled = 4
}
