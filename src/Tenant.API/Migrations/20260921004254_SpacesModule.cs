using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class SpacesModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "RoomsEntitled",
                table: "Tenants",
                newName: "SpacesEntitled");

            migrationBuilder.RenameColumn(
                name: "RoomsEnabled",
                table: "Tenants",
                newName: "SpacesEnabled");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SpacesEntitled",
                table: "Tenants",
                newName: "RoomsEntitled");

            migrationBuilder.RenameColumn(
                name: "SpacesEnabled",
                table: "Tenants",
                newName: "RoomsEnabled");
        }
    }
}
