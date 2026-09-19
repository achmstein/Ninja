using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Branch.API.Migrations
{
    /// <inheritdoc />
    public partial class BranchReceiptHeader : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReceiptFooter",
                table: "Branches",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TaxNumber",
                table: "Branches",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReceiptFooter",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "TaxNumber",
                table: "Branches");
        }
    }
}
