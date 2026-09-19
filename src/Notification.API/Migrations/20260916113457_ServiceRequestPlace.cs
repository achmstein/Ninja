using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Notification.API.Migrations
{
    /// <inheritdoc />
    public partial class ServiceRequestPlace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OptionCode",
                table: "ServiceRequests",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PlaceId",
                table: "ServiceRequests",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PlaceKind",
                table: "ServiceRequests",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Rooms kept their ids in the Places remodel, so a room request's
            // room is its place; a table request names the id a printed
            // sticker carries, which is not the place id.
            migrationBuilder.Sql("""
                UPDATE "ServiceRequests" SET "PlaceId" = "RoomId", "PlaceKind" = 'Room' WHERE "RoomId" IS NOT NULL AND "TableId" IS NULL;
                UPDATE "ServiceRequests" SET "PlaceKind" = 'Table' WHERE "TableId" IS NOT NULL;
                """);

            migrationBuilder.CreateTable(
                name: "Places",
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
                    table.PrimaryKey("PK_Places", x => x.PlaceId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_PlaceId_Status",
                table: "ServiceRequests",
                columns: new[] { "PlaceId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Places_LegacyRoomId",
                table: "Places",
                column: "LegacyRoomId");

            migrationBuilder.CreateIndex(
                name: "IX_Places_LegacyTableId",
                table: "Places",
                column: "LegacyTableId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Places");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_PlaceId_Status",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "OptionCode",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "PlaceId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "PlaceKind",
                table: "ServiceRequests");
        }
    }
}
