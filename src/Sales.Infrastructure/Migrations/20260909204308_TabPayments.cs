using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TabPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "tabpaymentseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "tab_payments",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Tender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ShiftId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tab_payments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_BranchId_Number",
                schema: "sales",
                table: "tab_payments",
                columns: new[] { "BranchId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_BranchId_RecordedAt",
                schema: "sales",
                table: "tab_payments",
                columns: new[] { "BranchId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_CustomerId",
                schema: "sales",
                table: "tab_payments",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_ShiftId",
                schema: "sales",
                table: "tab_payments",
                column: "ShiftId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tab_payments",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "tabpaymentseq",
                schema: "sales");
        }
    }
}
