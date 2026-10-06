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

    /// <summary>Every payment made for an order paid ahead, whatever its status, oldest first.</summary>
    Task<List<OnlinePayment>> ListForOrderAsync(int orderId);

    /// <summary>
    /// Holds the order's payment-due row until the transaction ends, so two checkouts for the same
    /// order take turns: the second sees the first's hold.
    /// </summary>
    Task LockOrderAsync(int orderId);

    /// <summary>
    /// Holds the ticket's row until the transaction ends, so two guests
    /// starting a payment on the same bill take turns: the second sees the
    /// first's hold and can never take the same share.
    /// </summary>
    Task LockTicketAsync(int ticketId);

    /// <summary>
    /// Takes the payment's money move for whoever asks, until <paramref name="until"/>, in one statement
    /// of its own (not the caller's transaction): true for the one caller that got it. A move already
    /// held by another, or no longer owed, is not taken.
    /// </summary>
    Task<bool> LeaseMoveAsync(Guid key, DateTime now, DateTime until);

    /// <summary>Gives a lease back early, the move left as it was (a caller that took it and then found it had nothing to do).</summary>
    Task ReleaseMoveAsync(Guid key);

    /// <summary>The business's payment settings, created with the defaults the first time they are asked for.</summary>
    Task<PaymentSettings> GetSettingsAsync();
}
