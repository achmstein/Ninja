using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryFeature : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A business already running keeps delivery until the control plane says what it bought
            // (the next entitlements push: an upgrade, a subscription change, a start)
            migrationBuilder.AddColumn<bool>(
                name: "DeliveryEnabled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "DeliveryEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeliveryEnabled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "DeliveryEntitled",
                table: "Tenants");
        }
    }
}
