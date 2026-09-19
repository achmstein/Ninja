namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

public enum PaymentTender
{
    Cash = 0,
    Card = 1,
    InstaPay = 2,

    /// <summary>Settled onto the customer's account tab (Accounts.API posts the charge).</summary>
    Account = 3,
}
