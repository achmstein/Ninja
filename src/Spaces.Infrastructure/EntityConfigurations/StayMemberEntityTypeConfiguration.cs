namespace Ninja.Spaces.Infrastructure.EntityConfigurations;

class StayMemberEntityTypeConfiguration : IEntityTypeConfiguration<StayMember>
{
    public void Configure(EntityTypeBuilder<StayMember> builder)
    {
        builder.ToTable("stay_members");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .UseHiLo("staymemberseq", "spaces");

        builder.Ignore(m => m.DomainEvents);

        builder.Property(m => m.StayId)
            .IsRequired();

        builder.Property(m => m.CustomerId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(m => m.CustomerName)
            .HasMaxLength(200);

        builder.Property(m => m.JoinedAt)
            .IsRequired();

        builder.Property(m => m.Role)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.HasIndex(m => m.StayId);
        builder.HasIndex(m => m.CustomerId);
        builder.HasIndex(m => new { m.StayId, m.CustomerId }).IsUnique();
    }
}
