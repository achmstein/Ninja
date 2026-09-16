using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PaidAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaidWith",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReceiptNumber",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RefundedAmount",
                schema: "ordering",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaidAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PaidWith",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ReceiptNumber",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "RefundedAmount",
                schema: "ordering",
                table: "orders");
        }
    }
}
