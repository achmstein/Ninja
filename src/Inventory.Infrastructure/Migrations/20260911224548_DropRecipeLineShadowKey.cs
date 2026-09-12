using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropRecipeLineShadowKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_recipe_lines_recipes_RecipeCatalogItemId",
                schema: "inventory",
                table: "recipe_lines");

            migrationBuilder.DropIndex(
                name: "IX_recipe_lines_RecipeCatalogItemId",
                schema: "inventory",
                table: "recipe_lines");

            migrationBuilder.DropColumn(
                name: "RecipeCatalogItemId",
                schema: "inventory",
                table: "recipe_lines");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RecipeCatalogItemId",
                schema: "inventory",
                table: "recipe_lines",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_recipe_lines_RecipeCatalogItemId",
                schema: "inventory",
                table: "recipe_lines",
                column: "RecipeCatalogItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_recipe_lines_recipes_RecipeCatalogItemId",
                schema: "inventory",
                table: "recipe_lines",
                column: "RecipeCatalogItemId",
                principalSchema: "inventory",
                principalTable: "recipes",
                principalColumn: "CatalogItemId");
        }
    }
}
