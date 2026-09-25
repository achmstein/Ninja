#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

public interface IOnlinePaymentRepository : IRepository<OnlinePayment>
{
    OnlinePayment Add(OnlinePayment payment);

    Task<OnlinePayment?> GetAsync(int id);

    /// <summary>The checkout a provider's callback names by its order.</summary>
    Task<OnlinePayment?> FindByProviderReferenceAsync(string provider, string reference);

    /// <summary>Every online payment on a ticket, whatever its status.</summary>
    Task<List<OnlinePayment>> ListForTicketAsync(int ticketId);
}
