using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TicketLabelAndLineGuestId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomerId",
                schema: "sales",
                table: "tickets");

            migrationBuilder.RenameColumn(
                name: "CustomerName",
                schema: "sales",
                table: "tickets",
                newName: "Label");

            migrationBuilder.AddColumn<string>(
                name: "GuestId",
                schema: "sales",
                table: "ticket_lines",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GuestId",
                schema: "sales",
                table: "ticket_lines");

            migrationBuilder.RenameColumn(
                name: "Label",
                schema: "sales",
                table: "tickets",
                newName: "CustomerName");

            migrationBuilder.AddColumn<string>(
                name: "CustomerId",
                schema: "sales",
                table: "tickets",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }
    }
}
