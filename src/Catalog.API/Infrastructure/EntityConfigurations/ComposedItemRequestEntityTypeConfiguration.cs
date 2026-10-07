namespace Ninja.Catalog.API.Infrastructure.EntityConfigurations;

class ComposedItemRequestEntityTypeConfiguration : IEntityTypeConfiguration<ComposedItemRequest>
{
    public void Configure(EntityTypeBuilder<ComposedItemRequest> builder)
    {
        builder.ToTable("ComposedItemRequests");

        builder.HasKey(r => r.RequestId);
        builder.Property(r => r.RequestId).ValueGeneratedNever();
        builder.Property(r => r.Options).IsRequired();
    }
}
