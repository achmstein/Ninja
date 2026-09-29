using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TalabatOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "platformupdateseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.AddColumn<string>(
                name: "Platform_AcceptedUrl",
                schema: "ordering",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Platform_CancelledAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_Code",
                schema: "ordering",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Platform_CollectFromCustomer",
                schema: "ordering",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_DeliveryAddress",
                schema: "ordering",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Platform_DueAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_Expedition",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_Name",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Platform_PaidOnline",
                schema: "ordering",
                table: "orders",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Platform_PickedUpAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_PickedUpUrl",
                schema: "ordering",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_PreparedUrl",
                schema: "ordering",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_RejectReason",
                schema: "ordering",
                table: "orders",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_RejectedUrl",
                schema: "ordering",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Platform_RiderPickupAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_ShortCode",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Platform_Token",
                schema: "ordering",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "platformupdates",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Token = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Reason = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    AcceptanceTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AbandonedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platformupdates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_Platform_Token",
                schema: "ordering",
                table: "orders",
                column: "Platform_Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_platformupdates_OrderId",
                schema: "ordering",
                table: "platformupdates",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_platformupdates_SentAt_AbandonedAt_NextAttemptAt",
                schema: "ordering",
                table: "platformupdates",
                columns: new[] { "SentAt", "AbandonedAt", "NextAttemptAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "platformupdates",
                schema: "ordering");

            migrationBuilder.DropIndex(
                name: "IX_orders_Platform_Token",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_AcceptedUrl",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_CancelledAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_Code",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_CollectFromCustomer",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_DeliveryAddress",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_DueAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_Expedition",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_Name",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_PaidOnline",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_PickedUpAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_PickedUpUrl",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_PreparedUrl",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_RejectReason",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_RejectedUrl",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_RiderPickupAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_ShortCode",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Platform_Token",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropSequence(
                name: "platformupdateseq",
                schema: "ordering");
        }
    }
}
