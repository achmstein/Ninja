using Microsoft.EntityFrameworkCore.Design;

namespace Chillax.Inventory.Infrastructure;

/// <summary>
/// Design-time factory for creating InventoryContext for EF migrations
/// </summary>
public class InventoryContextDesignFactory : IDesignTimeDbContextFactory<InventoryContext>
{
    public InventoryContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<InventoryContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=inventory;Username=postgres;Password=postgres");

        return new InventoryContext(optionsBuilder.Options);
    }
}
