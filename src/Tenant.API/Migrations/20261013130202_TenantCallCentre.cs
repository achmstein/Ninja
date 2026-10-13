using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantCallCentre : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Off on a business already running: its branch tills keep offering the
            // nearer branch until a call centre is bought (the entitlements push turns it on)
            migrationBuilder.AddColumn<bool>(
                name: "CallCentreEnabled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Allowed until the control plane says what was bought, as every switch is
            migrationBuilder.AddColumn<bool>(
                name: "CallCentreEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CallCentreEnabled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CallCentreEntitled",
                table: "Tenants");
        }
    }
}
