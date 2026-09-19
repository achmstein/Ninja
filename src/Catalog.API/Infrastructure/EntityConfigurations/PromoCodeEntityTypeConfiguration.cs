namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class PromoCodeEntityTypeConfiguration : IEntityTypeConfiguration<PromoCode>
{
    public void Configure(EntityTypeBuilder<PromoCode> builder)
    {
        builder.ToTable("PromoCodes");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Code).IsRequired().HasMaxLength(PromoCode.CodeMaxLength);
        builder.Property(p => p.Kind).HasConversion<string>().HasMaxLength(10);
        builder.Property(p => p.Value).HasPrecision(18, 2);
        builder.Property(p => p.MinSubtotal).HasPrecision(18, 2);

        builder.HasIndex(p => p.Code).IsUnique();
    }
}

class PromoRedemptionEntityTypeConfiguration : IEntityTypeConfiguration<PromoRedemption>
{
    public void Configure(EntityTypeBuilder<PromoRedemption> builder)
    {
        builder.ToTable("PromoRedemptions");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Code).IsRequired().HasMaxLength(PromoCode.CodeMaxLength);
        builder.Property(r => r.CustomerKey).IsRequired().HasMaxLength(64);
        builder.Property(r => r.Discount).HasPrecision(18, 2);

        builder.HasIndex(r => r.OrderId).IsUnique();
        builder.HasIndex(r => new { r.Code, r.CustomerKey });
    }
}
