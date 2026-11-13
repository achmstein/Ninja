using Ninja.Ordering.Infrastructure.Projections;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class TicketPlaceEntityTypeConfiguration : IEntityTypeConfiguration<TicketPlace>
{
    public void Configure(EntityTypeBuilder<TicketPlace> builder)
    {
        builder.ToTable("ticketplaces");

        // Keyed by Sales' ticket id — never generated here
        builder.HasKey(t => t.TicketId);
        builder.Property(t => t.TicketId).ValueGeneratedNever();

        builder.Property(t => t.PlaceKind).HasMaxLength(20);
        builder.Property(t => t.PlaceNameEn).HasMaxLength(200);
        builder.Property(t => t.PlaceNameAr).HasMaxLength(200);
    }
}
