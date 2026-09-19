namespace Ninja.Sales.Infrastructure.EntityConfigurations;

class ReceiptEntityTypeConfiguration : IEntityTypeConfiguration<Receipt>
{
    public void Configure(EntityTypeBuilder<Receipt> builder)
    {
        builder.ToTable("receipts");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .UseHiLo("receiptseq", "sales");

        builder.Ignore(r => r.DomainEvents);

        // The uniqueness of (branch, number) is what makes the per-branch
        // sequence trustworthy — a settle race loses here and retries
        builder.HasIndex(r => new { r.BranchId, r.Number }).IsUnique();

        builder.HasIndex(r => r.TicketId).IsUnique();
    }
}
