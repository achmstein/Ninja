using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CancelLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                schema: "sales",
                table: "ticket_lines",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CancelledAmount",
                schema: "sales",
                table: "ticket_lines",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                schema: "sales",
                table: "ticket_lines",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancelledBy",
                schema: "sales",
                table: "ticket_lines",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CancelledQty",
                schema: "sales",
                table: "ticket_lines",
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
                name: "CancelReason",
                schema: "sales",
                table: "ticket_lines");

            migrationBuilder.DropColumn(
                name: "CancelledAmount",
                schema: "sales",
                table: "ticket_lines");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                schema: "sales",
                table: "ticket_lines");

            migrationBuilder.DropColumn(
                name: "CancelledBy",
                schema: "sales",
                table: "ticket_lines");

            migrationBuilder.DropColumn(
                name: "CancelledQty",
                schema: "sales",
                table: "ticket_lines");
        }
    }
}
