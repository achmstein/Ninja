using Ninja.Sales.Domain.AggregatesModel.OnlinePaymentAggregate;

namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class OnlinePaymentEntityTypeConfiguration : IEntityTypeConfiguration<OnlinePayment>
{
    public void Configure(EntityTypeBuilder<OnlinePayment> builder)
    {
        builder.ToTable("online_payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("onlinepaymentseq", "sales");

        builder.Ignore(p => p.DomainEvents);
        builder.Ignore(p => p.Charged);

        builder.Property(p => p.Amount).HasPrecision(18, 2);
        builder.Property(p => p.Fee).HasPrecision(18, 2);
        builder.Property(p => p.Tip).HasPrecision(18, 2);
        builder.Property(p => p.Currency).HasMaxLength(3).IsRequired();
        builder.Property(p => p.Mode).HasConversion<string>().HasMaxLength(10).IsRequired();
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(10).IsRequired();
        builder.Property(p => p.PayerId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.PayerName).HasMaxLength(200);
        builder.Property(p => p.Provider).HasMaxLength(20).IsRequired();
        builder.Property(p => p.ProviderReference).HasMaxLength(100);
        builder.Property(p => p.TransactionId).HasMaxLength(100);
        builder.Property(p => p.FailureReason).HasMaxLength(500);
        builder.Property(p => p.RefundedBy).HasMaxLength(64);

        builder.HasIndex(p => p.Key).IsUnique();
        builder.HasIndex(p => p.TicketId);
        builder.HasIndex(p => new { p.Provider, p.ProviderReference });
        builder.HasIndex(p => new { p.BranchId, p.PaidAt });

        // A callback and a refund may land together; the second is told to reload
        builder.Property<uint>("xmin").IsRowVersion();
    }
}

class PaymentSettingsEntityTypeConfiguration : IEntityTypeConfiguration<PaymentSettings>
{
    public void Configure(EntityTypeBuilder<PaymentSettings> builder)
    {
        builder.ToTable("payment_settings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Ignore(s => s.DomainEvents);
        builder.Ignore(s => s.IsReady);
        builder.Ignore(s => s.IntegrationIds);

        builder.Property(s => s.Provider).HasMaxLength(20).IsRequired();
        builder.Property(s => s.Currency).HasMaxLength(3).IsRequired();
        builder.Property(s => s.SealedSecretKey).HasMaxLength(1000);
        builder.Property(s => s.SecretKeyHint).HasMaxLength(8);
        builder.Property(s => s.PublicKey).HasMaxLength(500);
        builder.Property(s => s.SealedHmacSecret).HasMaxLength(1000);
        builder.Property(s => s.FeeMode).HasConversion<string>().HasMaxLength(10).IsRequired();
        builder.Property(s => s.FeePercent).HasPrecision(6, 3);
        builder.Property(s => s.FeeFixed).HasPrecision(18, 2);
    }
}
