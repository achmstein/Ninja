using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Delivery_CashCollected",
                schema: "ordering",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Delivery_FailedAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_FailureReason",
                schema: "ordering",
                table: "orders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Delivery_ReturnedAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Delivery_Version",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "DeliveryRadiusKm",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric(9,2)",
                precision: 9,
                scale: 2,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "DeliveryMinimumOrder",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<decimal>(
                name: "DeliveryFee",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.CreateTable(
                name: "rideraccounts",
                schema: "ordering",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Branches = table.Column<List<int>>(type: "integer[]", nullable: false),
                    IsRider = table.Column<bool>(type: "boolean", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rideraccounts", x => x.UserId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_Delivery_Phone",
                schema: "ordering",
                table: "orders",
                column: "Delivery_Phone");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "rideraccounts",
                schema: "ordering");

            migrationBuilder.DropIndex(
                name: "IX_orders_Delivery_Phone",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CashCollected",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_FailedAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_FailureReason",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_ReturnedAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_Version",
                schema: "ordering",
                table: "orders");

            migrationBuilder.AlterColumn<decimal>(
                name: "DeliveryRadiusKm",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(9,2)",
                oldPrecision: 9,
                oldScale: 2,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "DeliveryMinimumOrder",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2);

            migrationBuilder.AlterColumn<decimal>(
                name: "DeliveryFee",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2);
        }
    }
}
