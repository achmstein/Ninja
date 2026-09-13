using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Finance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProfitFacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "costfactseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "labourfactseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "salesfactseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "cost_facts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cost_facts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "labour_facts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    EmployeeId = table.Column<int>(type: "integer", nullable: false),
                    PeriodStart = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodEnd = table.Column<DateOnly>(type: "date", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_labour_facts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sales_facts",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Vat = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_facts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cost_facts_BranchId_Date",
                schema: "finance",
                table: "cost_facts",
                columns: new[] { "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_cost_facts_Reference",
                schema: "finance",
                table: "cost_facts",
                column: "Reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_labour_facts_BranchId_PeriodStart",
                schema: "finance",
                table: "labour_facts",
                columns: new[] { "BranchId", "PeriodStart" });

            migrationBuilder.CreateIndex(
                name: "IX_labour_facts_EmployeeId_PeriodStart",
                schema: "finance",
                table: "labour_facts",
                columns: new[] { "EmployeeId", "PeriodStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_facts_BranchId_Date",
                schema: "finance",
                table: "sales_facts",
                columns: new[] { "BranchId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_sales_facts_Reference",
                schema: "finance",
                table: "sales_facts",
                column: "Reference",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cost_facts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "labour_facts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "sales_facts",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "costfactseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "labourfactseq",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "salesfactseq",
                schema: "finance");
        }
    }
}
