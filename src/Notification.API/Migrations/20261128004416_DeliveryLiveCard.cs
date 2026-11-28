using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Notification.API.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryLiveCard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Platform",
                table: "Subscriptions",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LastProgress",
                table: "DeliveryNotices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "LastStage",
                table: "DeliveryNotices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Platform",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "LastProgress",
                table: "DeliveryNotices");

            migrationBuilder.DropColumn(
                name: "LastStage",
                table: "DeliveryNotices");
        }
    }
}
