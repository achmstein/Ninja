#nullable enable
using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

namespace Ninja.Sales.Infrastructure.Repositories;

public class OnlinePaymentRepository(SalesContext context) : IOnlinePaymentRepository
{
    public IUnitOfWork UnitOfWork => context;

    public OnlinePayment Add(OnlinePayment payment)
        => context.OnlinePayments.Add(payment).Entity;

    public async Task<OnlinePayment?> GetAsync(int id)
        => await context.OnlinePayments.FirstOrDefaultAsync(p => p.Id == id);

    public async Task<OnlinePayment?> GetByKeyAsync(Guid key)
        => await context.OnlinePayments.FirstOrDefaultAsync(p => p.Key == key);

    public async Task<OnlinePayment?> FindByProviderReferenceAsync(string provider, string reference)
        => await context.OnlinePayments.FirstOrDefaultAsync(p => p.Provider == provider && p.ProviderReference == reference);

    public async Task<List<OnlinePayment>> ListForTicketAsync(int ticketId)
        => await context.OnlinePayments.Where(p => p.TicketId == ticketId).OrderBy(p => p.CreatedAt).ToListAsync();

    public async Task LockTicketAsync(int ticketId)
        => await context.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM sales.tickets WHERE \"Id\" = {ticketId} FOR UPDATE");

    public async Task<PaymentSettings> GetSettingsAsync()
    {
        var settings = await context.PaymentSettings.FirstOrDefaultAsync(s => s.Id == PaymentSettings.SingletonId);
        if (settings is not null) return settings;
        settings = new PaymentSettings();
        context.PaymentSettings.Add(settings);
        return settings;
    }
}
