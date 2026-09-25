using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantImageSlots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LogoVersion",
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

            migrationBuilder.AddColumn<string>(
                name: "Images",
                table: "Tenants",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Images",
                table: "Tenants");

            migrationBuilder.AddColumn<long>(
                name: "LogoVersion",
                table: "Tenants",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

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
    }
}
