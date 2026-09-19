namespace Ninja.Ordering.Infrastructure;

/// <summary>
/// Design-time factory for creating OrderingContext for EF migrations, so
/// `dotnet ef migrations add` runs against this project alone — without the
/// API as startup project, which cannot be built while it is running.
/// </summary>
public class OrderingContextDesignFactory : IDesignTimeDbContextFactory<OrderingContext>
{
    public OrderingContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<OrderingContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=ordering;Username=postgres;Password=postgres");

        return new OrderingContext(optionsBuilder.Options);
    }
}
