using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderPayAhead : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CollectsAtDoor",
                schema: "sales",
                table: "tickets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PayAhead",
                schema: "sales",
                table: "tenantfeatures",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<int>(
                name: "TicketId",
                schema: "sales",
                table: "online_payments",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "OrderId",
                schema: "sales",
                table: "online_payments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "orderpaymentsdue",
                schema: "sales",
                columns: table => new
                {
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PayerUserId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PayerGuestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PayerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    IsDelivery = table.Column<bool>(type: "boolean", nullable: false),
                    DueBy = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orderpaymentsdue", x => x.OrderId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_OrderId",
                schema: "sales",
                table: "online_payments",
                column: "OrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "orderpaymentsdue",
                schema: "sales");

            migrationBuilder.DropIndex(
                name: "IX_online_payments_OrderId",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "CollectsAtDoor",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "PayAhead",
                schema: "sales",
                table: "tenantfeatures");

            migrationBuilder.DropColumn(
                name: "OrderId",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.AlterColumn<int>(
                name: "TicketId",
                schema: "sales",
                table: "online_payments",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
