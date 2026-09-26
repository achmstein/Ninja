#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

public interface IOnlinePaymentRepository : IRepository<OnlinePayment>
{
    OnlinePayment Add(OnlinePayment payment);

    Task<OnlinePayment?> GetAsync(int id);

    /// <summary>The payment a guest's phone asks after.</summary>
    Task<OnlinePayment?> GetByKeyAsync(Guid key);

    /// <summary>The checkout a provider's callback names by its order.</summary>
    Task<OnlinePayment?> FindByProviderReferenceAsync(string provider, string reference);

    /// <summary>Every online payment on a ticket, whatever its status.</summary>
    Task<List<OnlinePayment>> ListForTicketAsync(int ticketId);

    /// <summary>
    /// Holds the ticket's row until the transaction ends, so two guests
    /// starting a payment on the same bill take turns: the second sees the
    /// first's hold and can never take the same share.
    /// </summary>
    Task LockTicketAsync(int ticketId);

    /// <summary>The café's payment settings, created with the defaults the first time they are asked for.</summary>
    Task<PaymentSettings> GetSettingsAsync();
}
