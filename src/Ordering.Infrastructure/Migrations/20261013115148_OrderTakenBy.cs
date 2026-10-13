using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderTakenBy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TakenAtBranchId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TakenByName",
                schema: "ordering",
                table: "orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TakenByUserId",
                schema: "ordering",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                schema: "ordering",
                table: "branchsettings",
                type: "boolean",
                nullable: false,
                // Every branch heard of so far is still the business's, until its next event says otherwise
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TakenAtBranchId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "TakenByName",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "TakenByUserId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "IsActive",
                schema: "ordering",
                table: "branchsettings");
        }
    }
}
