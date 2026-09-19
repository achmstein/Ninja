using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Notification.API.Migrations
{
    /// <inheritdoc />
    public partial class DropLegacyServiceRequestPlaceFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_RoomId_Status",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_Places_LegacyRoomId",
                table: "Places");

            migrationBuilder.DropIndex(
                name: "IX_Places_LegacyTableId",
                table: "Places");

            migrationBuilder.DropColumn(
                name: "RoomId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "TableId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "TableName",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "LegacyRoomId",
                table: "Places");

            migrationBuilder.DropColumn(
                name: "LegacyTableId",
                table: "Places");

            migrationBuilder.RenameColumn(
                name: "RoomName",
                table: "ServiceRequests",
                newName: "PlaceName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PlaceName",
                table: "ServiceRequests",
                newName: "RoomName");

            migrationBuilder.AddColumn<int>(
                name: "RoomId",
                table: "ServiceRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TableId",
                table: "ServiceRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TableName",
                table: "ServiceRequests",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyRoomId",
                table: "Places",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyTableId",
                table: "Places",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_RoomId_Status",
                table: "ServiceRequests",
                columns: new[] { "RoomId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Places_LegacyRoomId",
                table: "Places",
                column: "LegacyRoomId");

            migrationBuilder.CreateIndex(
                name: "IX_Places_LegacyTableId",
                table: "Places",
                column: "LegacyTableId");
        }
    }
}
