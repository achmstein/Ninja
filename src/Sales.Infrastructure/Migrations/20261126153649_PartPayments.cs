using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PartPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "partpaymentseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.AddColumn<int>(
                name: "PartPaymentId",
                schema: "sales",
                table: "payments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "part_payments",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    ShiftId = table.Column<int>(type: "integer", nullable: true),
                    Tender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PayerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LineIds = table.Column<List<int>>(type: "integer[]", nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReturnedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReturnedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ReturnedShiftId = table.Column<int>(type: "integer", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_part_payments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payments_PartPaymentId",
                schema: "sales",
                table: "payments",
                column: "PartPaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_part_payments_ReturnedShiftId",
                schema: "sales",
                table: "part_payments",
                column: "ReturnedShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_part_payments_ShiftId",
                schema: "sales",
                table: "part_payments",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_part_payments_TicketId",
                schema: "sales",
                table: "part_payments",
                column: "TicketId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "part_payments",
                schema: "sales");

            migrationBuilder.DropIndex(
                name: "IX_payments_PartPaymentId",
                schema: "sales",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "PartPaymentId",
                schema: "sales",
                table: "payments");

            migrationBuilder.DropSequence(
                name: "partpaymentseq",
                schema: "sales");
        }
    }
}
