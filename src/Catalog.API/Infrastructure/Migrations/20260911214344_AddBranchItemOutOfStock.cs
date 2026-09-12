using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchItemOutOfStock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOutOfStock",
                table: "BranchItemOverrides",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsOutOfStock",
                table: "BranchItemOverrides");
        }
    }
}
