namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class UserItemPreferenceEntityTypeConfiguration
    : IEntityTypeConfiguration<UserItemPreference>
{
    public void Configure(EntityTypeBuilder<UserItemPreference> builder)
    {
        builder.ToTable("UserItemPreferences");

        builder.HasKey(p => p.Id);

        builder.HasIndex(p => new { p.UserId, p.CatalogItemId })
            .IsUnique();

        builder.Property(p => p.UserId)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasOne(p => p.CatalogItem)
            .WithMany()
            .HasForeignKey(p => p.CatalogItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(p => p.SelectedOptions)
            .WithOne(o => o.UserItemPreference)
            .HasForeignKey(o => o.UserItemPreferenceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

class UserPreferenceOptionEntityTypeConfiguration
    : IEntityTypeConfiguration<UserPreferenceOption>
{
    public void Configure(EntityTypeBuilder<UserPreferenceOption> builder)
    {
        builder.ToTable("UserPreferenceOptions");

        builder.HasKey(o => o.Id);

        builder.HasIndex(o => new { o.UserItemPreferenceId, o.CustomizationId, o.OptionId })
            .IsUnique();
    }
}
