using Microsoft.EntityFrameworkCore.ChangeTracking;
using Ninja.Control.API.Model;
using Ninja.Control.API.Platform;

namespace Ninja.Control.API.Infrastructure;

public class ControlContext(DbContextOptions<ControlContext> options) : DbContext(options)
{
    private readonly SecretProtector _secrets = options.SecretProtector();

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<Node> Nodes => Set<Node>();

    public DbSet<ProvisioningStep> Steps => Set<ProvisioningStep>();

    public DbSet<PlatformAudit> Audits => Set<PlatformAudit>();

    public DbSet<Payment> Payments => Set<Payment>();

    public DbSet<Job> Jobs => Set<Job>();

    public DbSet<OutboxMail> Outbox => Set<OutboxMail>();

    public DbSet<AiProvider> AiProviders => Set<AiProvider>();

    public DbSet<AiRoleModel> AiRoles => Set<AiRoleModel>();

    public DbSet<AiUsage> AiUsage => Set<AiUsage>();

    public DbSet<MapsSettings> MapsSettings => Set<MapsSettings>();

    public DbSet<FirebaseSettings> FirebaseSettings => Set<FirebaseSettings>();

    public DbSet<TenantApp> TenantApps => Set<TenantApp>();

    public DbSet<AppBuildSettings> AppBuildSettings => Set<AppBuildSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppBuildSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.GitHubToken).HasMaxLength(1024).HasConversion(_secrets.NullableConverter());
            entity.Property(e => e.Repository).HasMaxLength(140).IsRequired();
            entity.Property(e => e.Workflow).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Ref).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<FirebaseSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            // A service account's key file is a few kilobytes: no limit
            entity.Property(e => e.ServiceAccountJson).HasConversion(_secrets.NullableConverter());
        });

        modelBuilder.Entity<TenantApp>(entity =>
        {
            entity.HasKey(e => e.TenantId);
            // Dropped with the record (Forget); kept while the record is, destroyed or not
            entity.HasOne<Tenant>().WithOne().HasForeignKey<TenantApp>(e => e.TenantId).OnDelete(DeleteBehavior.Cascade);
            var secret = _secrets.NullableConverter();
            entity.Property(e => e.UploadKeystore).HasConversion(secret);
            entity.Property(e => e.KeyAlias).HasMaxLength(512).HasConversion(secret);
            entity.Property(e => e.KeyPassword).HasMaxLength(512).HasConversion(secret);
            entity.Property(e => e.StorePassword).HasMaxLength(512).HasConversion(secret);
            entity.Property(e => e.PlayServiceAccountJson).HasConversion(secret);
            entity.Property(e => e.AscKeyId).HasMaxLength(64);
            entity.Property(e => e.AscIssuerId).HasMaxLength(64);
            entity.Property(e => e.AscPrivateKey).HasConversion(secret);
            entity.Property(e => e.UploadKeySha1).HasMaxLength(59);
            entity.Property(e => e.UploadKeySha256).HasMaxLength(95);
            entity.Property(e => e.FirebaseAndroidAppId).HasMaxLength(100);
            entity.Property(e => e.FirebaseIosAppId).HasMaxLength(100);
            entity.Property(e => e.Checks).HasColumnType("jsonb");
            entity.Property(e => e.BuildPlatform).HasMaxLength(16);
            entity.Property(e => e.BuildTrack).HasMaxLength(16);
        });

        modelBuilder.Entity<MapsSettings>(entity =>
        {
            // One row, always id 1
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            // Encrypted like the AI's keys; a Google key is 39 characters, a few times that once encrypted
            var key = _secrets.NullableConverter();
            entity.Property(e => e.ServerKey).HasMaxLength(512).HasConversion(key);
            entity.Property(e => e.BrowserKey).HasMaxLength(512).HasConversion(key);
            entity.Property(e => e.AndroidKey).HasMaxLength(512).HasConversion(key);
            entity.Property(e => e.IosKey).HasMaxLength(512).HasConversion(key);
            entity.Property(e => e.ReferrerDomains).HasMaxLength(4000);
        });

        modelBuilder.Entity<AiProvider>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(60).IsRequired();
            entity.Property(e => e.BaseUrl).HasMaxLength(300).IsRequired();
            // Encrypted like the tenants' secrets; a provider's key may run to a few hundred characters
            entity.Property(e => e.ApiKey).HasMaxLength(1024).IsRequired().HasConversion(_secrets.Converter());
        });

        modelBuilder.Entity<AiRoleModel>(entity =>
        {
            entity.HasKey(e => e.Role);
            entity.Property(e => e.Role).HasMaxLength(16);
            entity.Property(e => e.Model).HasMaxLength(120).IsRequired();
            entity.HasOne<AiProvider>().WithMany().HasForeignKey(e => e.ProviderId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AiUsage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Slug).HasMaxLength(24).IsRequired();
            entity.Property(e => e.Role).HasMaxLength(16).IsRequired();
            entity.Property(e => e.Model).HasMaxLength(120).IsRequired();
            entity.HasIndex(e => new { e.Slug, e.Day, e.Role, e.Model }).IsUnique();
            entity.HasIndex(e => e.Day);
        });

        modelBuilder.Entity<Node>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(32).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Kind).HasConversion<string>().HasMaxLength(8);
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(12);
            entity.Property(e => e.AgentUrl).HasMaxLength(200);
            entity.Property(e => e.IngressUrl).HasMaxLength(200);
            entity.Property(e => e.CertThumbprint).HasMaxLength(64);
            entity.Property(e => e.Architecture).HasMaxLength(8).IsRequired();
            entity.Property(e => e.KeycloakInternalUrl).HasMaxLength(200);
            entity.Property(e => e.AiGatewayUrl).HasMaxLength(200);
            entity.Property(e => e.TalabatRelayUrl).HasMaxLength(200);
            entity.Property(e => e.AgentVersion).HasMaxLength(40);
            entity.Property(e => e.LastError).HasMaxLength(2000);
        });

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
            entity.HasIndex(e => new { e.Status, e.Lane, e.NodeId });
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
            // A node with tenants on it cannot go; a move or a destroy takes them off first
            entity.Property(e => e.NodeId).HasDefaultValue(Node.HomeId);
            entity.HasOne<Node>().WithMany().HasForeignKey(e => e.NodeId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Node>().WithMany().HasForeignKey(e => e.MovingToNodeId).OnDelete(DeleteBehavior.Restrict);
            entity.Property(e => e.StatusBeforeMove).HasConversion<string>().HasMaxLength(16);
            entity.Property(e => e.Slug).HasMaxLength(24).IsRequired();
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.NameEn).HasMaxLength(80);
            entity.Property(e => e.NameAr).HasMaxLength(80);
            entity.Property(e => e.PrimaryColor).HasMaxLength(7);
            entity.Property(e => e.Slab).HasMaxLength(16);
            entity.Property(e => e.CustomerDomain).HasMaxLength(253);
            entity.Property(e => e.AppId).HasMaxLength(155);
            entity.Property(e => e.AppleTeamId).HasMaxLength(10);
            entity.Property(e => e.AndroidCertFingerprints).HasMaxLength(1000);
            entity.Property(e => e.OwnerEmail).HasMaxLength(254).IsRequired();
            // The secrets: encrypted at rest under the platform's key (enc:v1:… is 12 + 16 + n bytes in base64, 128 chars covers a 64-char secret)
            var secret = _secrets.Converter();
            var optionalSecret = _secrets.NullableConverter();
            entity.Property(e => e.OwnerInitialPassword).HasMaxLength(128).HasConversion(optionalSecret);
            entity.Property(e => e.IdentitySecret).HasMaxLength(128).IsRequired().HasConversion(secret);
            entity.Property(e => e.ControlSecret).HasMaxLength(128).IsRequired().HasConversion(secret);
            entity.Property(e => e.AssistantSecret).HasMaxLength(128).IsRequired().HasConversion(secret);
            entity.Property(e => e.PaymentsKey).HasMaxLength(128).IsRequired().HasConversion(secret);
            entity.Property(e => e.DbPassword).HasMaxLength(128).HasConversion(optionalSecret);
            entity.Property(e => e.BrokerPassword).HasMaxLength(128).HasConversion(optionalSecret);
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
            entity.Property(e => e.ContentLanguages).HasMaxLength(4).IsRequired().HasDefaultValue(ContentLanguages.Both);
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
            entity.Property(e => e.TalabatChainCode).HasMaxLength(64);
            entity.Property(e => e.TalabatGlobalEntityId).HasMaxLength(16);
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
