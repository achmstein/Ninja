namespace Ninja.Sales.Domain.AggregatesModel.TicketAggregate;

public enum PaymentTender
{
    Cash = 0,
    Card = 1,
    InstaPay = 2,

    /// <summary>Settled onto the customer's account tab (Accounts.API posts the charge).</summary>
    Account = 3,

    /// <summary>Paid by the guest from their phone through the café's payment provider (OnlinePayment); never cash in the drawer.</summary>
    Online = 4,

    /// <summary>
    /// A delivery platform's order the platform pays the café for (Talabat):
    /// settled by Sales itself when the order lands; never cash in the drawer,
    /// never offered at the till.
    /// </summary>
    Talabat = 5,
}
