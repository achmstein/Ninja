using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantOnlinePayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PayAtTableEntitled",
                table: "Tenants",
                newName: "OnlinePaymentsEntitled");

            migrationBuilder.RenameColumn(
                name: "PayAtTableEnabled",
                table: "Tenants",
                newName: "OnlinePaymentsEnabled");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "OnlinePaymentsEntitled",
                table: "Tenants",
                newName: "PayAtTableEntitled");

            migrationBuilder.RenameColumn(
                name: "OnlinePaymentsEnabled",
                table: "Tenants",
                newName: "PayAtTableEnabled");
        }
    }
}
