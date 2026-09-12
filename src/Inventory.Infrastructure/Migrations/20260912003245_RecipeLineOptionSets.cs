using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RecipeLineOptionSets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A line used to name one option; now it names the set it needs.
            // Carry every existing option line over as a one-element set.
            migrationBuilder.AddColumn<List<int>>(
                name: "OptionIds",
                schema: "inventory",
                table: "recipe_lines",
                type: "integer[]",
                nullable: false,
                defaultValueSql: "'{}'::integer[]");

            migrationBuilder.Sql("""
                UPDATE inventory.recipe_lines
                SET "OptionIds" = ARRAY["OptionId"]
                WHERE "OptionId" IS NOT NULL
                """);

            migrationBuilder.DropColumn(
                name: "OptionId",
                schema: "inventory",
                table: "recipe_lines");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OptionIds",
                schema: "inventory",
                table: "recipe_lines");

            migrationBuilder.AddColumn<int>(
                name: "OptionId",
                schema: "inventory",
                table: "recipe_lines",
                type: "integer",
                nullable: true);
        }
    }
}
