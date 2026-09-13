namespace Chillax.Payroll.Infrastructure.EntityConfigurations;

class LedgerEntryEntityTypeConfiguration : IEntityTypeConfiguration<LedgerEntry>
{
    public void Configure(EntityTypeBuilder<LedgerEntry> builder)
    {
        builder.ToTable("ledger");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseHiLo("ledgerseq", "payroll");

        builder.Ignore(l => l.DomainEvents);
        builder.Ignore(l => l.Signed);

        builder.Property(l => l.Amount).HasPrecision(18, 2);
        builder.Property(l => l.Note).HasMaxLength(500);
        builder.Property(l => l.Reference).HasMaxLength(100);
        builder.Property(l => l.RecordedBy).HasMaxLength(200).IsRequired();

        builder.HasIndex(l => new { l.EmployeeId, l.Date });

        // A payslip's Earned line and, later, a till pay-out post once: the
        // reference is the retry and redelivery guard
        builder.HasIndex(l => l.Reference)
            .IsUnique()
            .HasFilter("\"Reference\" IS NOT NULL");
    }
}
