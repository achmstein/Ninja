using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantAppLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AndroidCertFingerprints",
                table: "Tenants",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AppleTeamId",
                table: "Tenants",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AndroidCertFingerprints",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "AppleTeamId",
                table: "Tenants");
        }
    }
}
