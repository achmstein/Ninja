using Ninja.Control.API.Model;

namespace Ninja.Control.API.Infrastructure;

public class ControlContext(DbContextOptions<ControlContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<ProvisioningStep> Steps => Set<ProvisioningStep>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Slug).HasMaxLength(24).IsRequired();
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.NameEn).HasMaxLength(80).IsRequired();
            entity.Property(e => e.NameAr).HasMaxLength(80);
            entity.Property(e => e.PrimaryColor).HasMaxLength(7);
            entity.Property(e => e.CustomerDomain).HasMaxLength(253);
            entity.Property(e => e.OwnerEmail).HasMaxLength(254).IsRequired();
            entity.Property(e => e.OwnerInitialPassword).HasMaxLength(64);
            entity.Property(e => e.IdentitySecret).HasMaxLength(64).IsRequired();
            entity.Property(e => e.ControlSecret).HasMaxLength(64).IsRequired();
            entity.Property(e => e.ImageTag).HasMaxLength(64).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Seed).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Country).HasMaxLength(2).IsRequired();
            entity.Property(e => e.Currency).HasMaxLength(3).IsRequired();
            entity.Property(e => e.TimeZone).HasMaxLength(64).IsRequired();
            entity.Property(e => e.DefaultLanguage).HasMaxLength(2).IsRequired();
            entity.HasMany(e => e.Steps).WithOne().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProvisioningStep>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(40).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);
            entity.HasIndex(e => new { e.TenantId, e.RunId });
        });
    }
}
