using Microsoft.EntityFrameworkCore.Design;

namespace Chillax.Finance.Infrastructure;

/// <summary>
/// Design-time factory for creating FinanceContext for EF migrations
/// </summary>
public class FinanceContextDesignFactory : IDesignTimeDbContextFactory<FinanceContext>
{
    public FinanceContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<FinanceContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=finance;Username=postgres;Password=postgres");

        return new FinanceContext(optionsBuilder.Options);
    }
}
