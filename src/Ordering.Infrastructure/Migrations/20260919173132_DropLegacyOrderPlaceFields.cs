using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyOrderPlaceFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_places_LegacyRoomId",
                schema: "ordering",
                table: "places");

            migrationBuilder.DropIndex(
                name: "IX_places_LegacyTableId",
                schema: "ordering",
                table: "places");

            migrationBuilder.DropColumn(
                name: "LegacyRoomId",
                schema: "ordering",
                table: "places");

            migrationBuilder.DropColumn(
                name: "LegacyTableId",
                schema: "ordering",
                table: "places");

            migrationBuilder.DropColumn(
                name: "RoomId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "RoomName",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "TableId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "TableName",
                schema: "ordering",
                table: "orders");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LegacyRoomId",
                schema: "ordering",
                table: "places",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyTableId",
                schema: "ordering",
                table: "places",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RoomId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RoomName",
                schema: "ordering",
                table: "orders",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TableId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TableName",
                schema: "ordering",
                table: "orders",
                type: "jsonb",
                nullable: true);

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
    }
}
