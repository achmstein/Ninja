namespace Ninja.Accounts.Infrastructure.EntityConfigurations;

class CustomerAccountEntityTypeConfiguration : IEntityTypeConfiguration<CustomerAccount>
{
    public void Configure(EntityTypeBuilder<CustomerAccount> builder)
    {
        builder.ToTable("customer_accounts");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .UseHiLo("customeraccountseq", "accounts");

        builder.Ignore(a => a.DomainEvents);

        builder.Property(a => a.CustomerId)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.CustomerName)
            .HasMaxLength(200);

        builder.Property(a => a.Balance)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(a => a.CreatedAt)
            .IsRequired();

        builder.Property(a => a.UpdatedAt)
            .IsRequired();

        builder.HasMany(a => a.Transactions)
            .WithOne()
            .HasForeignKey(t => t.CustomerAccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(a => a.Transactions)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(a => a.CustomerId)
            .IsUnique();

        builder.HasIndex(a => a.Balance);
    }
}
