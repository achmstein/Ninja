using System.Text.Json;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Ninja.Branch.API.Model;
using Ninja.Branch.API.Services;

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
            entity.Property(e => e.Country).HasMaxLength(2).IsRequired();
            entity.Property(e => e.Currency).HasMaxLength(3).IsRequired();
            entity.Property(e => e.TimeZone).HasMaxLength(64).IsRequired();
            entity.Property(e => e.DefaultLanguage).HasMaxLength(2).IsRequired();
            entity.Property(e => e.ArabicStyle).HasMaxLength(10);
            entity.Property(e => e.BusinessType).HasMaxLength(20);
            entity.Ignore(e => e.EffectiveArabicStyle);
            entity.OwnsOne(e => e.Theme, b =>
            {
                b.ToJson();
                b.OwnsOne(t => t.Dark);
            });
            // A dictionary cannot be an owned JSON type; it is one jsonb document
            entity.Property(e => e.Images)
                .HasColumnType("jsonb")
                .HasConversion(
                    images => JsonSerializer.Serialize(images, ImagesJson),
                    json => JsonSerializer.Deserialize<Dictionary<string, TenantImage>>(json, ImagesJson) ?? new Dictionary<string, TenantImage>(),
                    new ValueComparer<Dictionary<string, TenantImage>>(
                        (a, b) => JsonSerializer.Serialize(a, ImagesJson) == JsonSerializer.Serialize(b, ImagesJson),
                        v => JsonSerializer.Serialize(v, ImagesJson).GetHashCode(),
                        v => JsonSerializer.Deserialize<Dictionary<string, TenantImage>>(JsonSerializer.Serialize(v, ImagesJson), ImagesJson)!));
            entity.Ignore(e => e.HasLogo);
            entity.Ignore(e => e.Version);
        });
    }

    /// <summary>camelCase keys in the stored document.</summary>
    public static readonly JsonSerializerOptions ImagesJson = new(JsonSerializerDefaults.Web);
}

public class BranchContextSeed(ILogger<BranchContextSeed> logger, IConfiguration configuration, TenantBrandStore brand) : IDbSeeder<BranchContext>
{
    public async Task SeedAsync(BranchContext context)
    {
        // Icons on disk cut by an older renderer are cut again from the mark, like a migration for the uploads
        if (await brand.RecutStaleIconsAsync(CancellationToken.None))
            logger.LogInformation("Cut the icons again from the mark (renderer {Renderer})", TenantBrandStore.IconRenderer);

        // The stack's tenant, from the environment the stack was provisioned
        // with (Tenant__Name__En, Tenant__Name__Ar, Tenant__PrimaryColor,
        // Tenant__CustomerUrl, Tenant__Country, Tenant__Currency,
        // Tenant__TimeZone, Tenant__DefaultLanguage); "Ninja" in Egypt until
        // someone says otherwise.
        if (!await context.Tenants.AnyAsync())
        {
            var section = configuration.GetSection("Tenant");
            var tenant = new Tenant
            {
                Name = new LocalizedText(section["Name:En"] is { Length: > 0 } en ? en : "Ninja", section["Name:Ar"]),
                PrimaryColor = section["PrimaryColor"] is { Length: > 0 } color ? color.ToLowerInvariant() : null,
                CustomerUrl = section["CustomerUrl"] is { Length: > 0 } url ? url.TrimEnd('/') : null,
            };
            if (section["Country"] is { Length: > 0 } country) tenant.Country = country.ToUpperInvariant();
            if (section["Currency"] is { Length: > 0 } currency) tenant.Currency = currency.ToUpperInvariant();
            if (section["TimeZone"] is { Length: > 0 } timeZone) tenant.TimeZone = timeZone;
            if (section["DefaultLanguage"] is { Length: > 0 } language) tenant.DefaultLanguage = language.ToLowerInvariant();
            context.Tenants.Add(tenant);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded the tenant");
        }

        // Every stack starts with one branch, so the till, the kitchen and
        // the customer app have somewhere to point; the owner renames it or
        // adds the rest. Tenant one (the dev AppHost, the E2E suite) plants
        // its own two with their late business day.
        if (!await context.Branches.AnyAsync())
        {
            if (SeedProfile.Of(configuration) == SeedProfile.Chillax)
            {
                context.Branches.AddRange(
                    new Model.Branch
                    {
                        Name = new LocalizedText("El-Manshia", "المنشية"),
                        DisplayOrder = 1,
                        DayStartTime = new TimeOnly(17, 0),
                        DayEndTime = new TimeOnly(5, 0),
                    },
                    new Model.Branch
                    {
                        Name = new LocalizedText("El-Benzina", "البنزينة"),
                        DisplayOrder = 2,
                        DayStartTime = new TimeOnly(17, 0),
                        DayEndTime = new TimeOnly(5, 0),
                    });
            }
            else
            {
                context.Branches.Add(new Model.Branch
                {
                    Name = new LocalizedText("Main", "الرئيسي"),
                    DisplayOrder = 1,
                });
            }

            await context.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} branch(es)", context.Branches.Local.Count);
        }
    }
}
