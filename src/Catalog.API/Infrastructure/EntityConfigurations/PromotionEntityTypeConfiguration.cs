namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class PromotionEntityTypeConfiguration : IEntityTypeConfiguration<Promotion>
{
    public void Configure(EntityTypeBuilder<Promotion> builder)
    {
        builder.ToTable("Promotions");

        builder.HasKey(p => p.Id);

        builder.OwnsOne(p => p.Headline, b => b.ToJson());
        builder.Property(p => p.PictureFileName).HasMaxLength(200);
        builder.Property(p => p.Link).HasConversion<string>().HasMaxLength(12);

        builder.HasIndex(p => p.IsActive);
    }
}
