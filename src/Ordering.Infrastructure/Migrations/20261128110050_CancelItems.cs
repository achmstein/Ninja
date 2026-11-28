using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CancelItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                schema: "ordering",
                table: "orderItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                schema: "ordering",
                table: "orderItems",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CancelledUnits",
                schema: "ordering",
                table: "orderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "CancelledItems",
                schema: "ordering",
                table: "kitchenprintjobs",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCancellation",
                schema: "ordering",
                table: "kitchenprintjobs",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelReason",
                schema: "ordering",
                table: "orderItems");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                schema: "ordering",
                table: "orderItems");

            migrationBuilder.DropColumn(
                name: "CancelledUnits",
                schema: "ordering",
                table: "orderItems");

            migrationBuilder.DropColumn(
                name: "CancelledItems",
                schema: "ordering",
                table: "kitchenprintjobs");

            migrationBuilder.DropColumn(
                name: "IsCancellation",
                schema: "ordering",
                table: "kitchenprintjobs");
        }
    }
}
