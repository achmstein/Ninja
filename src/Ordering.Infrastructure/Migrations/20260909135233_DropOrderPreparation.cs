using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropOrderPreparation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Preparation",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PreparingAt",
                schema: "ordering",
                table: "orders");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
        }
    }
}
