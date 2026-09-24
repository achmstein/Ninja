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

        builder.Property(s => s.PrinterName)
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

class PrintConnectorEntityTypeConfiguration : IEntityTypeConfiguration<PrintConnector>
{
    public void Configure(EntityTypeBuilder<PrintConnector> builder)
    {
        builder.ToTable("printconnectors");

        builder.Ignore(c => c.DomainEvents);

        builder.Property(c => c.Id)
            .UseHiLo("printconnectorseq");

        builder.Property(c => c.Name).HasMaxLength(100);
        builder.Property(c => c.KeyHash).HasMaxLength(64);
        builder.Property(c => c.Language).HasMaxLength(2);

        builder.HasIndex(c => c.BranchId);
    }
}

class ConnectorPairingEntityTypeConfiguration : IEntityTypeConfiguration<ConnectorPairing>
{
    public void Configure(EntityTypeBuilder<ConnectorPairing> builder)
    {
        builder.ToTable("connectorpairings");

        builder.Ignore(p => p.DomainEvents);

        builder.Property(p => p.Id)
            .UseHiLo("connectorpairingseq");

        builder.Property(p => p.Code).HasMaxLength(8);
        builder.Property(p => p.Language).HasMaxLength(2);

        builder.HasIndex(p => p.Code).IsUnique();
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
