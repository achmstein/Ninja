namespace Ninja.Ordering.API.Infrastructure;

/// <summary>
/// Simplified ordering context seed for business.
/// No card types needed - payment happens at POS.
/// </summary>
public class OrderingContextSeed : IDbSeeder<OrderingContext>
{
    public Task SeedAsync(OrderingContext context)
    {
        // No seeding required for simplified business ordering
        // Orders are created when customers place them
        return Task.CompletedTask;
    }
}
