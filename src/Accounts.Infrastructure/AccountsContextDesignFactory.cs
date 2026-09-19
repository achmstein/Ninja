namespace Ninja.Accounts.Infrastructure;

public class AccountsContextDesignFactory : IDesignTimeDbContextFactory<AccountsContext>
{
    public AccountsContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AccountsContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=accounts;Username=postgres;Password=postgres");

        return new AccountsContext(optionsBuilder.Options);
    }
}
