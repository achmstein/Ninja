using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantIsDrill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDrill",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDrill",
                table: "Tenants");
        }
    }
}
