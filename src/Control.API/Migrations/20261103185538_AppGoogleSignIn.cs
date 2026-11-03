using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class AppGoogleSignIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GoogleIosClientId",
                table: "TenantApps",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaySigningSha1",
                table: "TenantApps",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GoogleIosClientId",
                table: "TenantApps");

            migrationBuilder.DropColumn(
                name: "PlaySigningSha1",
                table: "TenantApps");
        }
    }
}
