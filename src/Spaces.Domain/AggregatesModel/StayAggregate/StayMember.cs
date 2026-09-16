namespace Chillax.Spaces.Domain.AggregatesModel.StayAggregate;

/// <summary>Someone in the party: the owner or a member who scanned in or was named by the till.</summary>
public class StayMember : Entity
{
    public int StayId { get; private set; }
    public string CustomerId { get; private set; }
    public string? CustomerName { get; private set; }
    public DateTime JoinedAt { get; private set; }
    public StayMemberRole Role { get; private set; }

    protected StayMember()
    {
        CustomerId = string.Empty;
    }

    internal StayMember(int stayId, string customerId, string? customerName, StayMemberRole role) : this()
    {
        StayId = stayId;
        CustomerId = customerId;
        CustomerName = customerName;
        JoinedAt = DateTime.UtcNow;
        Role = role;
    }
}
