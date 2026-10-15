using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StockMovementOccurredAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AvgUnitCostAfter",
                schema: "inventory",
                table: "stock_movements",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OccurredAt",
                schema: "inventory",
                table: "stock_movements",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // What is already on the ledger happened, as far as it knows, when
            // it was posted. Stock going out never moves the average, so the
            // cost it went out at is the average it left behind; what came in
            // may have moved it, and is left unknown
            migrationBuilder.Sql("""
                UPDATE inventory.stock_movements
                SET "OccurredAt" = "RecordedAt",
                    "AvgUnitCostAfter" = CASE WHEN "Quantity" < 0 THEN "UnitCost" END
                """);

            migrationBuilder.CreateIndex(
                name: "IX_stock_movements_BranchId_OccurredAt",
                schema: "inventory",
                table: "stock_movements",
                columns: new[] { "BranchId", "OccurredAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_stock_movements_BranchId_OccurredAt",
                schema: "inventory",
                table: "stock_movements");

            migrationBuilder.DropColumn(
                name: "AvgUnitCostAfter",
                schema: "inventory",
                table: "stock_movements");

            migrationBuilder.DropColumn(
                name: "OccurredAt",
                schema: "inventory",
                table: "stock_movements");
        }
    }
}
