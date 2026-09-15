using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <summary>
    /// A recipe line always belongs to a recipe. The foreign key was nullable,
    /// so editing a recipe left its old lines behind with no recipe instead of
    /// deleting them, and the sold-out lookup (which reads the key as an int)
    /// threw on the first receipt or sale that touched one of their
    /// ingredients. The orphans go, then the column is required.
    /// </summary>
    public partial class RequireRecipeLineRecipe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""DELETE FROM inventory.recipe_lines WHERE "CatalogItemId" IS NULL""");

            migrationBuilder.AlterColumn<int>(
                name: "CatalogItemId",
                schema: "inventory",
                table: "recipe_lines",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "CatalogItemId",
                schema: "inventory",
                table: "recipe_lines",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
