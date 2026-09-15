using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <summary>
    /// One shape for a size: an override line with the bigger amount, in
    /// the ingredient's slot. The size factor (RecipeScale) and the flag
    /// that said which lines it multiplied go; first, whatever a factor
    /// used to do is written into the lines, so every recipe deducts as it
    /// did: a scalable line that already names a size option grows by its
    /// factor, and every other scalable line gets a copy per size option,
    /// grown by that option's factor, unless the slot already has a line
    /// for that combination.
    /// </summary>
    public partial class DropRecipeScales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE inventory.recipe_lines l
                SET "Quantity" = l."Quantity" * s."Factor"
                FROM inventory.recipe_scales s
                WHERE s."CatalogItemId" = l."CatalogItemId"
                  AND l."Scalable" AND NOT l."IsNone"
                  AND s."OptionId" = ANY (l."OptionIds")
                """);

            // Ids come from the lines' HiLo sequence: each value starts a block of
            // ten EF never hands out again, so one per row is safe if wasteful
            migrationBuilder.Sql("""
                INSERT INTO inventory.recipe_lines ("Id", "CatalogItemId", "StockItemId", "Quantity", "OptionIds", "Slot", "IsNone", "Scalable")
                SELECT nextval('inventory.recipelineseq'), l."CatalogItemId", l."StockItemId", l."Quantity" * s."Factor",
                       (SELECT array_agg(o ORDER BY o) FROM unnest(array_append(l."OptionIds", s."OptionId")) AS o),
                       l."Slot", false, true
                FROM inventory.recipe_lines l
                JOIN inventory.recipe_scales s ON s."CatalogItemId" = l."CatalogItemId"
                WHERE l."Scalable" AND NOT l."IsNone"
                  AND NOT (s."OptionId" = ANY (l."OptionIds"))
                  AND NOT EXISTS (
                      SELECT 1 FROM inventory.recipe_lines x
                      WHERE x."CatalogItemId" = l."CatalogItemId" AND x."Slot" = l."Slot"
                        AND x."OptionIds" = (SELECT array_agg(o ORDER BY o) FROM unnest(array_append(l."OptionIds", s."OptionId")) AS o))
                """);

            migrationBuilder.DropTable(
                name: "recipe_scales",
                schema: "inventory");

            migrationBuilder.DropColumn(
                name: "Scalable",
                schema: "inventory",
                table: "recipe_lines");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Scalable",
                schema: "inventory",
                table: "recipe_lines",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "recipe_scales",
                schema: "inventory",
                columns: table => new
                {
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
                    OptionId = table.Column<int>(type: "integer", nullable: false),
                    Factor = table.Column<decimal>(type: "numeric(9,3)", precision: 9, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recipe_scales", x => new { x.CatalogItemId, x.OptionId });
                    table.ForeignKey(
                        name: "FK_recipe_scales_recipes_CatalogItemId",
                        column: x => x.CatalogItemId,
                        principalSchema: "inventory",
                        principalTable: "recipes",
                        principalColumn: "CatalogItemId",
                        onDelete: ReferentialAction.Cascade);
                });
        }
    }
}
