#nullable enable
namespace Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;

public interface IPartPaymentRepository : IRepository<PartPayment>
{
    PartPayment Add(PartPayment payment);

    Task<PartPayment?> GetAsync(int id);

    /// <summary>The part payments a ticket still counts: taken and not given back, oldest first.</summary>
    Task<List<PartPayment>> ListActiveForTicketAsync(int ticketId);
}
