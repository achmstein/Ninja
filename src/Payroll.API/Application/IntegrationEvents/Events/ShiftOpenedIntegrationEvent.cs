using Ninja.EventBus.Events;

namespace Ninja.Payroll.API.Application.IntegrationEvents.Events;

/// <summary>
/// Received when a cashier opens the drawer: they are at work. A partial
/// view of Sales' event; <see cref="OpenedByUserId"/> is null on shifts
/// from before Sales recorded it, and those mark nobody.
/// </summary>
public record ShiftOpenedIntegrationEvent : IntegrationEvent
{
    public int ShiftId { get; init; }

    public int BranchId { get; init; }

    public DateTime OpenedAt { get; init; }

    public string? OpenedByUserId { get; init; }
}
