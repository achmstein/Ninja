using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SalesNoTips : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TipPercents",
                schema: "sales",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "TipsEnabled",
                schema: "sales",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "Tip",
                schema: "sales",
                table: "online_payments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<int>>(
                name: "TipPercents",
                schema: "sales",
                table: "payment_settings",
                type: "integer[]",
                nullable: false);

            migrationBuilder.AddColumn<bool>(
                name: "TipsEnabled",
                schema: "sales",
                table: "payment_settings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "Tip",
                schema: "sales",
                table: "online_payments",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);
        }
    }
}
