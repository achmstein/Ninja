using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantEntitlements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FinanceEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "InventoryEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "KdsEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "LoyaltyEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "PayrollEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RoomsEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "TabsEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FinanceEntitled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "InventoryEntitled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "KdsEntitled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "LoyaltyEntitled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PayrollEntitled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "RoomsEntitled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "TabsEntitled",
                table: "Tenants");
        }
    }
}
