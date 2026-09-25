using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantPayAtTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PayAtTableEnabled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PayAtTableEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                // As every other entitlement: allowed until the control plane says otherwise (its next push does)
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PayAtTableEnabled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PayAtTableEntitled",
                table: "Tenants");
        }
    }
}
