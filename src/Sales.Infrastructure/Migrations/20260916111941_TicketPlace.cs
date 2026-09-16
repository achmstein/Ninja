using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TicketPlace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PlaceId",
                schema: "sales",
                table: "tickets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaceKind",
                schema: "sales",
                table: "tickets",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Rooms kept their ids in the Places remodel, so a room ticket's
            // room is its place. Table tickets carry the id the order named,
            // which is not the place id: they learn it from newer orders.
            migrationBuilder.Sql("""
                UPDATE sales.tickets SET "PlaceId" = "RoomId", "PlaceKind" = 'Room' WHERE "Type" = 'Room' AND "RoomId" IS NOT NULL;
                UPDATE sales.tickets SET "PlaceKind" = 'Table' WHERE "Type" = 'Table';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_tickets_PlaceId_Status",
                schema: "sales",
                table: "tickets",
                columns: new[] { "PlaceId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tickets_PlaceId_Status",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "PlaceId",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "PlaceKind",
                schema: "sales",
                table: "tickets");
        }
    }
}
