using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Seed",
                table: "Tenants",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "None");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Seed",
                table: "Tenants");
        }
    }
}
