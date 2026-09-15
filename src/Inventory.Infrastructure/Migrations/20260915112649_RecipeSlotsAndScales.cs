using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <summary>
    /// Recipes as slots (inventory-plan.md D6): lines gain the slot they
    /// belong to, whether size factors apply to them and whether they are a
    /// none override; size factors get a table of their own. Behaviour-
    /// preserving: every line becomes its own slot.
    /// </summary>
    public partial class RecipeSlotsAndScales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsNone",
                schema: "inventory",
                table: "recipe_lines",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "Scalable",
                schema: "inventory",
                table: "recipe_lines",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "Slot",
                schema: "inventory",
                table: "recipe_lines",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Every existing line becomes a slot of its own, numbered in the
            // order it was saved, so the recipe deducts exactly as before (each
            // line independently, an option line only when chosen) until it is
            // restructured. Pieces do not grow with a size; weights and volumes do.
            migrationBuilder.Sql("""
                UPDATE inventory.recipe_lines l
                SET "Slot" = n.slot
                FROM (
                    SELECT "Id", ROW_NUMBER() OVER (PARTITION BY "CatalogItemId" ORDER BY "Id") AS slot
                    FROM inventory.recipe_lines
                ) n
                WHERE l."Id" = n."Id"
                """);

            migrationBuilder.Sql("""
                UPDATE inventory.recipe_lines l
                SET "Scalable" = (s."Unit" <> 'pcs')
                FROM inventory.stock_items s
                WHERE s."Id" = l."StockItemId"
                """);

            migrationBuilder.CreateTable(
                name: "recipe_scales",
                schema: "inventory",
                columns: table => new
                {
                    OptionId = table.Column<int>(type: "integer", nullable: false),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: false),
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "recipe_scales",
                schema: "inventory");

            migrationBuilder.DropColumn(
                name: "IsNone",
                schema: "inventory",
                table: "recipe_lines");

            migrationBuilder.DropColumn(
                name: "Scalable",
                schema: "inventory",
                table: "recipe_lines");

            migrationBuilder.DropColumn(
                name: "Slot",
                schema: "inventory",
                table: "recipe_lines");
        }
    }
}
