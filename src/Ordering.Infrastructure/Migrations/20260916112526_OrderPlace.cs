using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderPlace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PlaceId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaceKind",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaceName",
                schema: "ordering",
                table: "orders",
                type: "jsonb",
                nullable: true);

            // Rooms kept their ids in the Places remodel, so a room order's
            // room is its place. A table order names the id a printed sticker
            // carries, which is not the place id: the kind and name are known,
            // the id arrives with the next order from a newer client.
            migrationBuilder.Sql("""
                UPDATE ordering.orders SET "PlaceId" = "RoomId", "PlaceKind" = 'Room', "PlaceName" = "RoomName"
                    WHERE "RoomName" IS NOT NULL OR "RoomId" IS NOT NULL;
                UPDATE ordering.orders SET "PlaceKind" = 'Table', "PlaceName" = "TableName"
                    WHERE "PlaceKind" IS NULL AND "TableId" IS NOT NULL;
                """);

            migrationBuilder.CreateTable(
                name: "places",
                schema: "ordering",
                columns: table => new
                {
                    PlaceId = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    IsTimed = table.Column<bool>(type: "boolean", nullable: false),
                    HasOptions = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LegacyRoomId = table.Column<int>(type: "integer", nullable: true),
                    LegacyTableId = table.Column<int>(type: "integer", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_places", x => x.PlaceId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_PlaceId",
                schema: "ordering",
                table: "orders",
                column: "PlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_places_LegacyRoomId",
                schema: "ordering",
                table: "places",
                column: "LegacyRoomId");

            migrationBuilder.CreateIndex(
                name: "IX_places_LegacyTableId",
                schema: "ordering",
                table: "places",
                column: "LegacyTableId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "places",
                schema: "ordering");

            migrationBuilder.DropIndex(
                name: "IX_orders_PlaceId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PlaceId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PlaceKind",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PlaceName",
                schema: "ordering",
                table: "orders");
        }
    }
}
