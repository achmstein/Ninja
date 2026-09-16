using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TicketDiscount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Discount",
                schema: "sales",
                table: "tickets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "DiscountAt",
                schema: "sales",
                table: "tickets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiscountBy",
                schema: "sales",
                table: "tickets",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountRate",
                schema: "sales",
                table: "tickets",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DiscountReason",
                schema: "sales",
                table: "tickets",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaxCashierDiscountRate",
                schema: "sales",
                table: "branch_pricing",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: false,
                defaultValue: 0.10m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Discount",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "DiscountAt",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "DiscountBy",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "DiscountRate",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "DiscountReason",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "MaxCashierDiscountRate",
                schema: "sales",
                table: "branch_pricing");
        }
    }
}
