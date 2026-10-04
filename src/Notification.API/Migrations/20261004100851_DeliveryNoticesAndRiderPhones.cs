using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Notification.API.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryNoticesAndRiderPhones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DeliveryNotices",
                columns: table => new
                {
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    LastVersion = table.Column<int>(type: "integer", nullable: false),
                    LastEventId = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeliveryNotices", x => x.OrderId);
                });

            // One rider per phone from now on: where two riders already share one, the one who signed
            // in on it last keeps it, before the index that holds it so is made
            migrationBuilder.Sql("""
                DELETE FROM "Subscriptions" s
                USING "Subscriptions" newer
                WHERE s."Type" = 7 AND newer."Type" = 7 AND s."FcmToken" = newer."FcmToken"
                  AND (newer."UpdatedAt" > s."UpdatedAt" OR (newer."UpdatedAt" = s."UpdatedAt" AND newer."Id" > s."Id"));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Subscriptions_FcmToken_Type_Rider",
                table: "Subscriptions",
                columns: new[] { "FcmToken", "Type" },
                unique: true,
                filter: "\"Type\" = 7");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DeliveryNotices");

            migrationBuilder.DropIndex(
                name: "IX_Subscriptions_FcmToken_Type_Rider",
                table: "Subscriptions");
        }
    }
}
