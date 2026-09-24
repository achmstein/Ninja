using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantBusinessArabicTheme : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ArabicStyle",
                table: "Tenants",
                type: "text",
                nullable: false,
                defaultValue: "standard");

            // Cafés made before it was a choice speak the Arabic they always did
            migrationBuilder.Sql("""UPDATE "Tenants" SET "ArabicStyle" = 'egyptian' WHERE "Country" = 'EG'""");

            migrationBuilder.AddColumn<int>(
                name: "BusinessType",
                table: "Tenants",
                type: "integer",
                nullable: false,
                // Other: nothing is assumed about a café made before it was asked
                defaultValue: 3);

            migrationBuilder.AddColumn<string>(
                name: "DefaultTheme",
                table: "Tenants",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ArabicStyle",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "BusinessType",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "DefaultTheme",
                table: "Tenants");
        }
    }
}
