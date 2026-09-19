using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Branch.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantTheme : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Theme",
                table: "Tenants",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<int>(
                name: "WordmarkHeight",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "WordmarkVersion",
                table: "Tenants",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "WordmarkWidth",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Theme",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "WordmarkHeight",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "WordmarkVersion",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "WordmarkWidth",
                table: "Tenants");
        }
    }
}
