using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyPlaceIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_places_LegacyRoomId",
                schema: "spaces",
                table: "places");

            migrationBuilder.DropIndex(
                name: "IX_places_LegacyTableId",
                schema: "spaces",
                table: "places");

            migrationBuilder.DropColumn(
                name: "LegacyRoomId",
                schema: "spaces",
                table: "places");

            migrationBuilder.DropColumn(
                name: "LegacyTableId",
                schema: "spaces",
                table: "places");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LegacyRoomId",
                schema: "spaces",
                table: "places",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyTableId",
                schema: "spaces",
                table: "places",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_places_LegacyRoomId",
                schema: "spaces",
                table: "places",
                column: "LegacyRoomId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_places_LegacyTableId",
                schema: "spaces",
                table: "places",
                column: "LegacyTableId",
                unique: true);
        }
    }
}
