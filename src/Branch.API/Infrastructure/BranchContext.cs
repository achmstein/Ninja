using Ninja.Branch.API.Model;

namespace Ninja.Branch.API.Infrastructure;

public class BranchContext(DbContextOptions<BranchContext> options) : DbContext(options)
{
    public DbSet<Model.Branch> Branches => Set<Model.Branch>();

    public DbSet<Tenant> Tenants => Set<Tenant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Model.Branch>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.OwnsOne(e => e.Name, b => b.ToJson());
            entity.OwnsOne(e => e.Address, b => b.ToJson());
            entity.Property(e => e.Phone).HasMaxLength(20);
            entity.Property(e => e.TaxNumber).HasMaxLength(30);
            entity.OwnsOne(e => e.ReceiptFooter, b => b.ToJson());
            entity.Property(e => e.IsActive).IsRequired();
            entity.Property(e => e.DisplayOrder).IsRequired();

            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.DisplayOrder);
        });

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.OwnsOne(e => e.Name, b => b.ToJson());
            entity.Property(e => e.PrimaryColor).HasMaxLength(7);
            entity.Property(e => e.CustomerUrl).HasMaxLength(200);
            entity.Ignore(e => e.HasLogo);
            entity.Ignore(e => e.Version);
        });
    }
}

public class BranchContextSeed(ILogger<BranchContextSeed> logger, IConfiguration configuration) : IDbSeeder<BranchContext>
{
    public async Task SeedAsync(BranchContext context)
    {
        // The stack's tenant, from the environment the stack was provisioned
        // with (Tenant__Name__En, Tenant__Name__Ar, Tenant__PrimaryColor);
        // Tenant__CustomerUrl); "Ninja" until someone names it.
        if (!await context.Tenants.AnyAsync())
        {
            var section = configuration.GetSection("Tenant");
            context.Tenants.Add(new Tenant
            {
                Name = new LocalizedText(section["Name:En"] is { Length: > 0 } en ? en : "Ninja", section["Name:Ar"]),
                PrimaryColor = section["PrimaryColor"] is { Length: > 0 } color ? color.ToLowerInvariant() : null,
                CustomerUrl = section["CustomerUrl"] is { Length: > 0 } url ? url.TrimEnd('/') : null,
            });
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded the tenant");
        }

        if (!await context.Branches.AnyAsync())
        {
            context.Branches.AddRange(
                new Model.Branch
                {
                    Name = new LocalizedText("El-Manshia", "المنشية"),
                    IsActive = true,
                    DisplayOrder = 1
                },
                new Model.Branch
                {
                    Name = new LocalizedText("El-Benzina", "البنزينة"),
                    IsActive = true,
                    DisplayOrder = 2
                }
            );
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded default branches");
        }
    }
}
