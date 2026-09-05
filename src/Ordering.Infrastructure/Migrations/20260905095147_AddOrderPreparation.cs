using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderPreparation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ConfirmedAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Preparation",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "NotStarted");

            migrationBuilder.AddColumn<DateTime>(
                name: "PreparingAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReadyAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConfirmedAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Preparation",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PreparingAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ReadyAt",
                schema: "ordering",
                table: "orders");
        }
    }
}
