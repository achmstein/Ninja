namespace Chillax.Payroll.Infrastructure.EntityConfigurations;

class EmployeeEntityTypeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .UseHiLo("employeeseq", "payroll");

        builder.Ignore(e => e.DomainEvents);
        builder.Ignore(e => e.IsActive);
        builder.Ignore(e => e.CurrentTerms);

        builder.Property(e => e.Name).HasMaxLength(200).IsRequired();
        builder.Property(e => e.JobTitle).HasMaxLength(100);
        builder.Property(e => e.Phone).HasMaxLength(50);
        builder.Property(e => e.UserId).HasMaxLength(100);

        // One employee per login
        builder.HasIndex(e => e.UserId).IsUnique();
        builder.HasIndex(e => e.BranchId);

        builder.HasMany(e => e.Terms)
            .WithOne()
            .HasForeignKey("EmployeeId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(e => e.Terms).AutoInclude();
    }
}

class PayTermsEntityTypeConfiguration : IEntityTypeConfiguration<PayTerms>
{
    public void Configure(EntityTypeBuilder<PayTerms> builder)
    {
        builder.ToTable("pay_terms");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .UseHiLo("paytermsseq", "payroll");

        builder.Ignore(t => t.DomainEvents);

        builder.Property(t => t.Rate).HasPrecision(18, 2);

        // One set of terms per employee per start date
        builder.HasIndex("EmployeeId", nameof(PayTerms.EffectiveFrom)).IsUnique();
    }
}
