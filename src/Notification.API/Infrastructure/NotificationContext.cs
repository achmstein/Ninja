using Chillax.Notification.API.Model;

namespace Chillax.Notification.API.Infrastructure;

public class NotificationContext(DbContextOptions<NotificationContext> options) : DbContext(options)
{
    public DbSet<NotificationSubscription> Subscriptions => Set<NotificationSubscription>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<NotificationPreferences> Preferences => Set<NotificationPreferences>();
    public DbSet<Announcement> Announcements => Set<Announcement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<NotificationSubscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.FcmToken).IsRequired();
            entity.Property(e => e.Type).IsRequired();
            entity.Property(e => e.PreferredLanguage).HasMaxLength(5).HasDefaultValue("en");
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Index for efficient lookups by user
            entity.HasIndex(e => e.UserId);

            // Index for efficient lookups by type
            entity.HasIndex(e => e.Type);

            // BranchId for branch-scoped admin subscriptions (null for global/customer subscriptions)
            entity.Property(e => e.BranchId);

            // Unique constraint: one subscription per user per type
            entity.HasIndex(e => new { e.UserId, e.Type }).IsUnique();
        });

        modelBuilder.Entity<ServiceRequest>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired().HasMaxLength(256);
            entity.Property(e => e.UserName).IsRequired().HasMaxLength(256);
            entity.OwnsOne(e => e.RoomName, b => b.ToJson());
            entity.OwnsOne(e => e.TableName, b => b.ToJson());
            entity.Property(e => e.RequestType).IsRequired();
            entity.Property(e => e.Status).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.AcknowledgedBy).HasMaxLength(256);

            // Index for efficient lookups by user and status
            entity.HasIndex(e => new { e.UserId, e.Status });

            entity.Property(e => e.BranchId).IsRequired().HasDefaultValue(1);

            // Index for efficient lookups by branch and status
            entity.HasIndex(e => new { e.BranchId, e.Status });

            // Index for efficient lookups by room and status
            entity.HasIndex(e => new { e.RoomId, e.Status });

            // Index for ordering by created date
            entity.HasIndex(e => e.CreatedAt);

            // Index for pending requests
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.Entity<Announcement>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Body).IsRequired().HasMaxLength(1000);
            entity.Property(e => e.SentBy).IsRequired().HasMaxLength(256);
            entity.Property(e => e.SentAt).IsRequired();

            // Index for ordering the history list
            entity.HasIndex(e => e.SentAt);
        });

        modelBuilder.Entity<NotificationPreferences>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired().HasMaxLength(256);
            entity.Property(e => e.OrderStatusUpdates).IsRequired();
            entity.Property(e => e.PromotionsAndOffers).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Unique constraint: one preferences record per user
            entity.HasIndex(e => e.UserId).IsUnique();
        });
    }
}

public class NotificationContextSeed(ILogger<NotificationContextSeed> logger) : IDbSeeder<NotificationContext>
{
    public Task SeedAsync(NotificationContext context)
    {
        logger.LogInformation("Notification database ready (no seed data required)");
        return Task.CompletedTask;
    }
}
