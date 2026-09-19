using Microsoft.EntityFrameworkCore.Design;

namespace Ninja.Payroll.Infrastructure;

/// <summary>
/// Design-time factory for creating PayrollContext for EF migrations
/// </summary>
public class PayrollContextDesignFactory : IDesignTimeDbContextFactory<PayrollContext>
{
    public PayrollContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<PayrollContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=payroll;Username=postgres;Password=postgres");

        return new PayrollContext(optionsBuilder.Options);
    }
}
