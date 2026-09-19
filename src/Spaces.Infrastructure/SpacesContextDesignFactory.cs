using Microsoft.EntityFrameworkCore.Design;

namespace Ninja.Spaces.Infrastructure;

/// <summary>
/// Design-time factory for creating SpacesContext for EF migrations
/// </summary>
public class SpacesContextDesignFactory : IDesignTimeDbContextFactory<SpacesContext>
{
    public SpacesContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<SpacesContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=spaces;Username=postgres;Password=postgres");

        return new SpacesContext(optionsBuilder.Options);
    }
}
