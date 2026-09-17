namespace Chillax.Notification.API.Model;

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
    /// <summary>The rate option asked for by a <see cref="ServiceRequestType.ChangeOption"/> request ("multi", "single", ...).</summary>
    public string? OptionCode { get; set; }
    // LEGACY(places): old room id column beside PlaceId — remove when every till and customer app is on /api/places and /api/stays.
    public int? RoomId { get; set; }
    public int BranchId { get; set; }
    /// <summary>
    /// LEGACY(places): old room name column, doubling as the place name — remove when every till and customer app is on /api/places and /api/stays.
    /// The place the till goes to: the room, or the table's name for a table request.
    /// </summary>
    public LocalizedText RoomName { get; set; } = new LocalizedText(string.Empty);
    /// <summary>
    /// LEGACY(places): old table id column beside PlaceId — remove when every till and customer app is on /api/places and /api/stays.
    /// The table the request came from; null for a room.
    /// </summary>
    public int? TableId { get; set; }
    // LEGACY(places): old table name column beside PlaceId/PlaceKind — remove when every till and customer app is on /api/places and /api/stays.
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
    // LEGACY(places): the two-option room request types, mapped onto ChangeOption("multi"/"single") — remove when every till and customer app is on /api/places and /api/stays.
    SwitchToMulti = 4,
    SwitchToSingle = 5,
    /// <summary>Switch the stay to another rate option of the place's tariff; the option travels in OptionCode. SwitchToMulti/SwitchToSingle are the two-option room case of this.</summary>
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
