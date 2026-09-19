namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class UserItemFavoriteEntityTypeConfiguration
    : IEntityTypeConfiguration<UserItemFavorite>
{
    public void Configure(EntityTypeBuilder<UserItemFavorite> builder)
    {
        builder.ToTable("UserItemFavorites");

        builder.HasKey(f => f.Id);

        builder.HasIndex(f => new { f.UserId, f.CatalogItemId })
            .IsUnique();

        builder.Property(f => f.UserId)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(f => f.AddedAt)
            .IsRequired();

        builder.HasOne(f => f.CatalogItem)
            .WithMany()
            .HasForeignKey(f => f.CatalogItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
