namespace Chillax.Inventory.Infrastructure.EntityConfigurations;

class RecipeEntityTypeConfiguration : IEntityTypeConfiguration<Recipe>
{
    public void Configure(EntityTypeBuilder<Recipe> builder)
    {
        builder.ToTable("recipes");

        // The menu item is the key: one recipe per item, no id of its own
        builder.HasKey(r => r.CatalogItemId);
        builder.Property(r => r.CatalogItemId).ValueGeneratedNever();

        // A filtered view over Lines, not a second collection
        builder.Ignore(r => r.BaseLines);

        // Required, so a line taken out of the recipe is deleted, not left
        // behind with a null recipe (an orphan the sold-out lookup trips on)
        builder.HasMany(r => r.Lines)
            .WithOne()
            .HasForeignKey("CatalogItemId")
            .IsRequired()
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(r => r.Lines).AutoInclude();
    }
}

class RecipeLineEntityTypeConfiguration : IEntityTypeConfiguration<RecipeLine>
{
    public void Configure(EntityTypeBuilder<RecipeLine> builder)
    {
        builder.ToTable("recipe_lines");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id)
            .UseHiLo("recipelineseq", "inventory");

        builder.Ignore(l => l.DomainEvents);
        builder.Ignore(l => l.IsBase);

        builder.Property(l => l.Quantity).HasPrecision(18, 3);

        // Slots: lines with the same number are one thing a sale takes
        builder.Property(l => l.Slot).HasDefaultValue(0);
        builder.Property(l => l.IsNone).HasDefaultValue(false);

        // A Postgres integer[]: empty for a base line, the sorted option ids
        // a combination needs otherwise
        builder.Property(l => l.OptionIds).IsRequired();
        builder.Ignore(l => l.OptionKey);

        builder.HasOne<StockItem>()
            .WithMany()
            .HasForeignKey(l => l.StockItemId)
            .OnDelete(DeleteBehavior.Restrict);

        // "Which menu items need this ingredient" is the sold-out lookup
        builder.HasIndex(l => l.StockItemId);
    }
}
