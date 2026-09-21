using Microsoft.EntityFrameworkCore.ChangeTracking;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Infrastructure;

public class ControlContext(DbContextOptions<ControlContext> options) : DbContext(options)
{
    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<ProvisioningStep> Steps => Set<ProvisioningStep>();

    public DbSet<PlatformAudit> Audits => Set<PlatformAudit>();

    public DbSet<Payment> Payments => Set<Payment>();

    public DbSet<Job> Jobs => Set<Job>();

    public DbSet<OutboxMail> Outbox => Set<OutboxMail>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Job>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Action).HasMaxLength(20).IsRequired();
            entity.Property(e => e.ImageTag).HasMaxLength(64);
            entity.Property(e => e.Lane).HasConversion<string>().HasMaxLength(8);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(10);
            entity.Property(e => e.Error).HasMaxLength(4000);
            entity.Property(e => e.RequestedBy).HasMaxLength(64).IsRequired();
            // What a worker asks for: the next queued job in its lane
            entity.HasIndex(e => new { e.Status, e.Lane, e.Priority, e.Id });
            entity.HasIndex(e => new { e.TenantId, e.Status });
        });

        modelBuilder.Entity<OutboxMail>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.To).HasMaxLength(254).IsRequired();
            entity.Property(e => e.Subject).HasMaxLength(500).IsRequired();
            entity.Property(e => e.Template).HasMaxLength(40).IsRequired();
            entity.Property(e => e.Slug).HasMaxLength(24);
            entity.Property(e => e.ReplyTo).HasMaxLength(254);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(10);
            entity.Property(e => e.LastError).HasMaxLength(2000);
            entity.HasIndex(e => new { e.Status, e.Id });
        });

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
            entity.Property(e => e.DbPassword).HasMaxLength(64);
            entity.Property(e => e.BrokerPassword).HasMaxLength(64);
            entity.Property(e => e.ImageTag).HasMaxLength(64).IsRequired();
            entity.Property(e => e.PreviousImageTag).HasMaxLength(64);
            entity.Property(e => e.UpgradeBackupId).HasMaxLength(15);
            entity.Property(e => e.RestoreFrom).HasMaxLength(48);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Seed).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Country).HasMaxLength(2).IsRequired();
            entity.Property(e => e.Currency).HasMaxLength(3).IsRequired();
            entity.Property(e => e.TimeZone).HasMaxLength(64).IsRequired();
            entity.Property(e => e.DefaultLanguage).HasMaxLength(2).IsRequired();
            entity.Property(e => e.ContactName).HasMaxLength(80);
            entity.Property(e => e.Phone).HasMaxLength(30);
            entity.Property(e => e.Address).HasMaxLength(200);
            entity.Property(e => e.Plan).HasConversion<string>().HasMaxLength(16);
            // The add-ons by name, so a module can be renamed in one migration and the column reads in psql:
            // a Postgres array; a joined string on any other provider (the in-memory one the tests run on)
            var addons = new ValueComparer<Module[]>((a, b) => a!.SequenceEqual(b!), v => v.Aggregate(0, (h, m) => HashCode.Combine(h, m)), v => v.ToArray());
            if (Database.IsNpgsql())
                entity.Property(e => e.Addons)
                    .HasConversion(v => v.Select(m => m.ToString()).ToArray(), v => v.Select(s => Enum.Parse<Module>(s)).ToArray(), addons)
                    .HasColumnType("text[]");
            else
                entity.Property(e => e.Addons)
                    .HasConversion(v => string.Join(',', v), v => v.Length == 0 ? Array.Empty<Module>() : v.Split(',').Select(s => Enum.Parse<Module>(s)).ToArray(), addons);
            entity.Property(e => e.Subscription).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Notes).HasMaxLength(2000);
            entity.HasMany(e => e.Steps).WithOne().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(e => e.Payments).WithOne().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Amount).HasPrecision(12, 2);
            entity.Property(e => e.Currency).HasMaxLength(3).IsRequired();
            entity.Property(e => e.Reference).HasMaxLength(64);
            entity.Property(e => e.Note).HasMaxLength(500);
            entity.Property(e => e.RecordedBy).HasMaxLength(64).IsRequired();
            entity.HasIndex(e => new { e.TenantId, e.Id });
        });

        modelBuilder.Entity<PlatformAudit>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Actor).HasMaxLength(64).IsRequired();
            entity.Property(e => e.ActorEmail).HasMaxLength(254);
            entity.Property(e => e.Source).HasMaxLength(16).IsRequired();
            entity.Property(e => e.Action).HasMaxLength(40).IsRequired();
            entity.Property(e => e.Slug).HasMaxLength(24);
            entity.Property(e => e.Details).HasColumnType("jsonb");
            entity.HasIndex(e => new { e.Slug, e.Id });
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
