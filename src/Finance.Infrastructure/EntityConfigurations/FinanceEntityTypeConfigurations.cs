namespace Ninja.Finance.Infrastructure.EntityConfigurations;

class ExpenseCategoryEntityTypeConfiguration : IEntityTypeConfiguration<ExpenseCategory>
{
    public void Configure(EntityTypeBuilder<ExpenseCategory> builder)
    {
        builder.ToTable("expense_categories");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .UseHiLo("expensecategoryseq", "finance");

        builder.Ignore(c => c.DomainEvents);

        builder.OwnsOne(c => c.Name, name =>
        {
            name.Property(n => n.En).HasColumnName("NameEn").HasMaxLength(100).IsRequired();
            name.Property(n => n.Ar).HasColumnName("NameAr").HasMaxLength(100);
        });
    }
}

class ExpenseEntityTypeConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> builder)
    {
        builder.ToTable("expenses");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .UseHiLo("expenseseq", "finance");

        builder.Ignore(e => e.DomainEvents);
        builder.Ignore(e => e.IsVoided);

        builder.Property(e => e.Amount).HasPrecision(18, 2);
        builder.Property(e => e.Vendor).HasMaxLength(200);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Reference).HasMaxLength(100);
        builder.Property(e => e.RecordedBy).HasMaxLength(200).IsRequired();
        builder.Property(e => e.VoidedBy).HasMaxLength(200);
        builder.Property(e => e.VoidReason).HasMaxLength(500);

        builder.HasIndex(e => new { e.BranchId, e.Date });

        // A till pay-out posts once: the reference is the redelivery guard
        builder.HasIndex(e => e.Reference)
            .IsUnique()
            .HasFilter("\"Reference\" IS NOT NULL");
    }
}

class RecurringExpenseEntityTypeConfiguration : IEntityTypeConfiguration<RecurringExpense>
{
    public void Configure(EntityTypeBuilder<RecurringExpense> builder)
    {
        builder.ToTable("recurring_expenses");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .UseHiLo("recurringexpenseseq", "finance");

        builder.Ignore(r => r.DomainEvents);

        builder.Property(r => r.Amount).HasPrecision(18, 2);
        builder.Property(r => r.Vendor).HasMaxLength(200);
        builder.Property(r => r.Note).HasMaxLength(500);

        builder.HasIndex(r => r.BranchId);
    }
}

class ExpenseReceiptEntityTypeConfiguration : IEntityTypeConfiguration<ExpenseReceipt>
{
    public void Configure(EntityTypeBuilder<ExpenseReceipt> builder)
    {
        builder.ToTable("expense_receipts");

        // One per expense, keyed by it: the id comes from the expense, never generated here
        builder.HasKey(r => r.ExpenseId);
        builder.Property(r => r.ExpenseId).ValueGeneratedNever();

        builder.Property(r => r.ContentType).HasMaxLength(100).IsRequired();
        builder.Property(r => r.FileName).HasMaxLength(200).IsRequired();
        builder.Property(r => r.UploadedBy).HasMaxLength(200).IsRequired();
        builder.Property(r => r.Data).IsRequired();
    }
}

class SupplierEntityTypeConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("suppliers");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .UseHiLo("supplierseq", "finance");

        builder.Ignore(s => s.DomainEvents);

        builder.Property(s => s.Name).HasMaxLength(200).IsRequired();
        builder.Property(s => s.Phone).HasMaxLength(50);
        builder.Property(s => s.Notes).HasMaxLength(500);
    }
}

class SupplierEntryEntityTypeConfiguration : IEntityTypeConfiguration<SupplierEntry>
{
    public void Configure(EntityTypeBuilder<SupplierEntry> builder)
    {
        builder.ToTable("supplier_entries");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .UseHiLo("supplierentryseq", "finance");

        builder.Ignore(e => e.DomainEvents);
        builder.Ignore(e => e.Signed);

        builder.Property(e => e.Amount).HasPrecision(18, 2);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Reference).HasMaxLength(100);
        builder.Property(e => e.RecordedBy).HasMaxLength(200).IsRequired();

        builder.HasIndex(e => new { e.SupplierId, e.BranchId, e.Date });

        builder.HasIndex(e => e.Reference)
            .IsUnique()
            .HasFilter("\"Reference\" IS NOT NULL");
    }
}

class PartnerEntityTypeConfiguration : IEntityTypeConfiguration<Partner>
{
    public void Configure(EntityTypeBuilder<Partner> builder)
    {
        builder.ToTable("partners");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .UseHiLo("partnerseq", "finance");

        builder.Ignore(p => p.DomainEvents);

        builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Phone).HasMaxLength(50);
        builder.Property(p => p.UserId).HasMaxLength(100);

        // Derived from the shares
        builder.Ignore(p => p.BranchIds);

        builder.HasMany(p => p.Shares)
            .WithOne()
            .HasForeignKey("PartnerId")
            .IsRequired()
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(p => p.Shares).AutoInclude();
    }
}

class PartnerShareEntityTypeConfiguration : IEntityTypeConfiguration<PartnerShare>
{
    public void Configure(EntityTypeBuilder<PartnerShare> builder)
    {
        builder.ToTable("partner_shares");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .UseHiLo("partnershareseq", "finance");

        builder.Ignore(s => s.DomainEvents);

        builder.Property(s => s.Percent).HasPrecision(5, 2);

        // One share per partner per branch
        builder.HasIndex("PartnerId", nameof(PartnerShare.BranchId)).IsUnique();
    }
}

class PartnerEntryEntityTypeConfiguration : IEntityTypeConfiguration<PartnerEntry>
{
    public void Configure(EntityTypeBuilder<PartnerEntry> builder)
    {
        builder.ToTable("partner_entries");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .UseHiLo("partnerentryseq", "finance");

        builder.Ignore(e => e.DomainEvents);
        builder.Ignore(e => e.Signed);

        builder.Property(e => e.Amount).HasPrecision(18, 2);
        builder.Property(e => e.Note).HasMaxLength(500);
        builder.Property(e => e.Reference).HasMaxLength(100);
        builder.Property(e => e.RecordedBy).HasMaxLength(200).IsRequired();

        builder.HasIndex(e => new { e.PartnerId, e.BranchId, e.Date });

        builder.HasIndex(e => e.Reference)
            .IsUnique()
            .HasFilter("\"Reference\" IS NOT NULL");
    }
}
