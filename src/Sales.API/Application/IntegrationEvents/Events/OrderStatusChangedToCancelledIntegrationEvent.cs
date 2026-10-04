#nullable enable
using Ninja.EventBus.Events;

namespace Ninja.Sales.API.Application.IntegrationEvents.Events;

/// <summary>
/// Consumer copy of Ordering's event: an order was cancelled. Only one that
/// already has a bill matters here: a delivery the till cancelled after it
/// could not be handed over (failed, or brought back), with no cash taken in.
/// </summary>
public record OrderStatusChangedToCancelledIntegrationEvent(int OrderId) : IntegrationEvent;
