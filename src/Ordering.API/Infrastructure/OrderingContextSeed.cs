namespace Ninja.Ordering.API.Infrastructure;

using DomainOrder = Ninja.Ordering.Domain.AggregatesModel.OrderAggregate.Order;

/// <summary>
/// Nothing to seed: orders are created when customers place them. What runs here is the upkeep of
/// what is already kept.
/// </summary>
public class OrderingContextSeed(TenantCountry country, ILogger<OrderingContextSeed> logger) : IDbSeeder<OrderingContext>
{
    public async Task SeedAsync(OrderingContext context)
    {
        // Numbers kept the old local way (010…) put in the one form (+2010…), so a caller's earlier
        // deliveries and a guest's earlier orders are still found by the number as it is read now
        var rewritten =
            await context.KeepPhonesInOneFormAsync<DomainOrder>(nameof(DomainOrder.GuestPhone), PhoneColumns.Customer(country.Code)) +
            await DeliveryModule.KeepPhonesInOneFormAsync(context, country.Code);
        if (rewritten > 0)
        {
            logger.LogInformation("Phones rewritten in the international form: {Count}", rewritten);
        }
    }
}
