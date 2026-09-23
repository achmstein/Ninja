using Ninja.Ordering.Domain.AggregatesModel.KitchenAggregate;

namespace Ninja.Ordering.Infrastructure.EntityConfigurations;

class KitchenStationEntityTypeConfiguration : IEntityTypeConfiguration<KitchenStation>
{
    public void Configure(EntityTypeBuilder<KitchenStation> builder)
    {
        builder.ToTable("kitchenstations");

        builder.Ignore(s => s.DomainEvents);

        builder.Property(s => s.Id)
            .UseHiLo("kitchenstationseq");

        builder.OwnsOne(s => s.Name, b => b.ToJson());

        builder.Property(s => s.PrinterHost)
            .HasMaxLength(255);

        builder.HasIndex(s => s.BranchId);
    }
}

class OrderStationPartEntityTypeConfiguration : IEntityTypeConfiguration<OrderStationPart>
{
    public void Configure(EntityTypeBuilder<OrderStationPart> builder)
    {
        builder.ToTable("orderstationparts");

        builder.Ignore(p => p.DomainEvents);

        builder.Property(p => p.Id)
            .UseHiLo("orderstationpartseq");

        builder.Property<int>("OrderId");

        builder.OwnsOne(p => p.StationName, b => b.ToJson());

        // Whether a station still has work waiting is asked by station
        builder.HasIndex(p => p.StationId);
    }
}

class KitchenPrintJobEntityTypeConfiguration : IEntityTypeConfiguration<KitchenPrintJob>
{
    public void Configure(EntityTypeBuilder<KitchenPrintJob> builder)
    {
        builder.ToTable("kitchenprintjobs");

        builder.Ignore(j => j.DomainEvents);

        builder.Property(j => j.Id)
            .UseHiLo("kitchenprintjobseq");

        builder.Property(j => j.ClaimedBy)
            .HasMaxLength(64);

        builder.Property(j => j.LastError)
            .HasMaxLength(300);

        // The print host asks for the branch's unprinted tickets
        builder.HasIndex(j => new { j.BranchId, j.PrintedAt });
    }
}
