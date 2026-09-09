using Chillax.Accounts.API.Application.Commands;
using Chillax.Accounts.Domain.AggregatesModel.CustomerAccountAggregate;
using Chillax.Accounts.API.IntegrationEvents.Events;
using Chillax.EventBus.Abstractions;
using MediatR;

namespace Chillax.Accounts.API.IntegrationEvents.EventHandling;

/// <summary>
/// A tab payment taken at the till is a payment on the ledger: the balance
/// owed drops by the slip's amount. Idempotent via a reference per slip,
/// because the bus redelivers and a tab must never be credited twice. The
/// customer's name travels so a tab that does not exist yet is opened
/// rather than the money being lost.
/// </summary>
public class TabPaymentRecordedIntegrationEventHandler(
    IMediator mediator,
    ILogger<TabPaymentRecordedIntegrationEventHandler> logger)
    : IIntegrationEventHandler<TabPaymentRecordedIntegrationEvent>
{
    public async Task Handle(TabPaymentRecordedIntegrationEvent @event)
    {
        if (string.IsNullOrEmpty(@event.CustomerId))
        {
            // Sales refuses a tab payment that names no customer, so this is
            // a malformed event, not a normal case — say so loudly
            logger.LogError(
                "Tab payment #{Number} of {Amount} names no customer - NOT posted",
                @event.Number, @event.Amount);
            return;
        }

        await mediator.Send(new RecordPaymentCommand(
            @event.CustomerId,
            @event.Amount,
            description: null,
            @event.RecordedBy,
            reference: $"sales-tab-payment:{@event.TabPaymentId}",
            source: TransactionSource.PosTabPayment,
            sourceNumber: @event.Number,
            customerName: @event.CustomerName ?? string.Empty));

        logger.LogInformation(
            "Credited {Amount} to {CustomerId}'s account for tab payment #{Number}",
            @event.Amount, @event.CustomerId, @event.Number);
    }
}
