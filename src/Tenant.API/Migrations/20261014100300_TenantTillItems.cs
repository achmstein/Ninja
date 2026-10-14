using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantTillItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A business already running keeps the photo tiles its till has always shown
            migrationBuilder.AddColumn<string>(
                name: "TillItems",
                table: "Tenants",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "photos");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TillItems",
                table: "Tenants");
        }
    }
}
