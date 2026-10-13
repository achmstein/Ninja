using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TicketTakenBy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TakenAtBranchId",
                schema: "sales",
                table: "tickets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TakenBy",
                schema: "sales",
                table: "tickets",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TakenAtBranchId",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "TakenBy",
                schema: "sales",
                table: "tickets");
        }
    }
}
