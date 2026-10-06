using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderPayAhead : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "PayAhead",
                schema: "ordering",
                table: "tenantfeatures",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "OnlinePaymentKey",
                schema: "ordering",
                table: "orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaidOnlineAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentDueBy",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PaysOnline",
                schema: "ordering",
                table: "orders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_orders_OrderStatus_PaymentDueBy",
                schema: "ordering",
                table: "orders",
                columns: new[] { "OrderStatus", "PaymentDueBy" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_orders_OrderStatus_PaymentDueBy",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PayAhead",
                schema: "ordering",
                table: "tenantfeatures");

            migrationBuilder.DropColumn(
                name: "OnlinePaymentKey",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PaidOnlineAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PaymentDueBy",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PaysOnline",
                schema: "ordering",
                table: "orders");
        }
    }
}
