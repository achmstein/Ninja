using Microsoft.EntityFrameworkCore.Design;

namespace Ninja.Sales.Infrastructure;

/// <summary>
/// Design-time factory for creating SalesContext for EF migrations
/// </summary>
public class SalesContextDesignFactory : IDesignTimeDbContextFactory<SalesContext>
{
    public SalesContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<SalesContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=sales;Username=postgres;Password=postgres");

        return new SalesContext(optionsBuilder.Options);
    }
}
