namespace Ninja.Notification.API.Model;

/// <summary>
/// The last move of a delivery this service told anyone about. The bus
/// delivers at least once and in no promised order: an event already told
/// (the same one again) or older than the last one told (a late "Assigned"
/// after "On the way") rings nobody's phone a second time.
/// </summary>
public class DeliveryNotice
{
    public int OrderId { get; set; }

    /// <summary>Ordering's count of the delivery's moves at the last one told; 0 from an Ordering older than the count.</summary>
    public int LastVersion { get; set; }

    /// <summary>The last event told, for an Ordering that sends no count: the same event twice is still told once.</summary>
    public Guid LastEventId { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>Where a delivery has got to, as Ordering names its stages.</summary>
public enum DeliveryStage
{
    /// <summary>A stage this copy does not know yet: nothing is pushed for it.</summary>
    Unknown = 0,
    Waiting,
    Assigned,
    OnTheWay,
    Delivered,
    /// <summary>The rider could not hand it over (nobody at the door, refused).</summary>
    Failed,
    /// <summary>It came back to the branch.</summary>
    Returned,
}
