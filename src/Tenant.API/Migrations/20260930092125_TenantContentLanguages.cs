using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantContentLanguages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentLanguages",
                table: "Tenants",
                type: "character varying(4)",
                maxLength: 4,
                nullable: false,
                defaultValue: "both");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContentLanguages",
                table: "Tenants");
        }
    }
}
