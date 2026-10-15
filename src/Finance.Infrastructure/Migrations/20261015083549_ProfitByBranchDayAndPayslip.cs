using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Finance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProfitByBranchDayAndPayslip : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_labour_facts_EmployeeId_PeriodStart",
                schema: "finance",
                table: "labour_facts");

            migrationBuilder.AddColumn<int>(
                name: "TicketId",
                schema: "finance",
                table: "sales_facts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AsOf",
                schema: "finance",
                table: "labour_facts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "PayslipId",
                schema: "finance",
                table: "labour_facts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "branch_day_starts",
                schema: "finance",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    DayStart = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branch_day_starts", x => x.BranchId);
                });

            // The sales already booked name their ticket in their reference; a
            // refund that comes in from now on finds its sale by it
            migrationBuilder.Sql("""
                UPDATE finance.sales_facts
                SET "TicketId" = CAST(substring("Reference" from 8) AS integer)
                WHERE "Kind" = 0 AND "Reference" ~ '^ticket:[0-9]+$'
                """);

            migrationBuilder.CreateIndex(
                name: "IX_sales_facts_TicketId",
                schema: "finance",
                table: "sales_facts",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_labour_facts_PayslipId_EmployeeId_PeriodStart",
                schema: "finance",
                table: "labour_facts",
                columns: new[] { "PayslipId", "EmployeeId", "PeriodStart" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branch_day_starts",
                schema: "finance");

            migrationBuilder.DropIndex(
                name: "IX_sales_facts_TicketId",
                schema: "finance",
                table: "sales_facts");

            migrationBuilder.DropIndex(
                name: "IX_labour_facts_PayslipId_EmployeeId_PeriodStart",
                schema: "finance",
                table: "labour_facts");

            migrationBuilder.DropColumn(
                name: "TicketId",
                schema: "finance",
                table: "sales_facts");

            migrationBuilder.DropColumn(
                name: "AsOf",
                schema: "finance",
                table: "labour_facts");

            migrationBuilder.DropColumn(
                name: "PayslipId",
                schema: "finance",
                table: "labour_facts");

            migrationBuilder.CreateIndex(
                name: "IX_labour_facts_EmployeeId_PeriodStart",
                schema: "finance",
                table: "labour_facts",
                columns: new[] { "EmployeeId", "PeriodStart" },
                unique: true);
        }
    }
}
