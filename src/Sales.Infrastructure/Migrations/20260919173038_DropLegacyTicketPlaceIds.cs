using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyTicketPlaceIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tickets_TableId_Status",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "RoomId",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "TableId",
                schema: "sales",
                table: "tickets");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RoomId",
                schema: "sales",
                table: "tickets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TableId",
                schema: "sales",
                table: "tickets",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tickets_TableId_Status",
                schema: "sales",
                table: "tickets",
                columns: new[] { "TableId", "Status" });
        }
    }
}
