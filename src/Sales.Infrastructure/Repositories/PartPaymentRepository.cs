#nullable enable
using Ninja.Sales.Domain.AggregatesModel.PartPaymentAggregate;

namespace Ninja.Sales.Infrastructure.Repositories;

public class PartPaymentRepository(SalesContext context) : IPartPaymentRepository
{
    public IUnitOfWork UnitOfWork => context;

    public PartPayment Add(PartPayment payment)
        => context.PartPayments.Add(payment).Entity;

    public async Task<PartPayment?> GetAsync(int id)
        => await context.PartPayments.FirstOrDefaultAsync(p => p.Id == id);

    public async Task<List<PartPayment>> ListActiveForTicketAsync(int ticketId)
        => await context.PartPayments
            .Where(p => p.TicketId == ticketId && p.ReturnedAt == null)
            .OrderBy(p => p.RecordedAt)
            .ThenBy(p => p.Id)
            .ToListAsync();
}
