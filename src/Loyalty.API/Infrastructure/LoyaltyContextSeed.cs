using Microsoft.Extensions.Hosting;

namespace Ninja.Loyalty.API.Infrastructure;

public class LoyaltyContextSeed : IDbSeeder<LoyaltyContext>
{
    public Task SeedAsync(LoyaltyContext context)
    {
        // No seed data needed for loyalty - accounts are created on demand
        return Task.CompletedTask;
    }
}
