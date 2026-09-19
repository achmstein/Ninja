using Ninja.Loyalty.API.Model;
using Microsoft.EntityFrameworkCore;

namespace Ninja.Loyalty.API.Infrastructure;

public class LoyaltyContext : DbContext
{
    public LoyaltyContext(DbContextOptions<LoyaltyContext> options) : base(options)
    {
    }

    public DbSet<LoyaltyAccount> Accounts => Set<LoyaltyAccount>();
    public DbSet<PointsTransaction> Transactions => Set<PointsTransaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<LoyaltyAccount>(entity =>
        {
            entity.ToTable("LoyaltyAccounts");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.CurrentTier).HasConversion<int>();
        });

        modelBuilder.Entity<PointsTransaction>(entity =>
        {
            entity.ToTable("PointsTransactions");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.AccountId);
            entity.HasIndex(e => e.ReferenceId);
            entity.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Description).IsRequired(false);
            entity.HasOne(e => e.Account)
                .WithMany(a => a.Transactions)
                .HasForeignKey(e => e.AccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
