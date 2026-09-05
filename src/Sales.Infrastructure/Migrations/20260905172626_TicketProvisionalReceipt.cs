using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TicketProvisionalReceipt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProvisionalReceiptNumber",
                schema: "sales",
                table: "tickets",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProvisionalReceiptNumber",
                schema: "sales",
                table: "tickets");
        }
    }
}
