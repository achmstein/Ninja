using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BillChargesAndRefunds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "refundlineseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "refundseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceCharge",
                schema: "sales",
                table: "tickets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceChargeRate",
                schema: "sales",
                table: "tickets",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Subtotal",
                schema: "sales",
                table: "tickets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Total",
                schema: "sales",
                table: "tickets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Vat",
                schema: "sales",
                table: "tickets",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "VatIncluded",
                schema: "sales",
                table: "tickets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                schema: "sales",
                table: "tickets",
                type: "numeric(5,4)",
                precision: 5,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "branch_pricing",
                schema: "sales",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    VatRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    PricesIncludeVat = table.Column<bool>(type: "boolean", nullable: false),
                    ServiceChargeRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branch_pricing", x => x.BranchId);
                });

            migrationBuilder.CreateTable(
                name: "refunds",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: false),
                    ReceiptNumber = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Tender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RefundedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RefundedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ShiftId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refunds", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refund_lines",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    TicketLineId = table.Column<int>(type: "integer", nullable: false),
                    Qty = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MenuAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: true),
                    RefundId = table.Column<int>(type: "integer", nullable: true),
                    Description = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_refund_lines_refunds_RefundId",
                        column: x => x.RefundId,
                        principalSchema: "sales",
                        principalTable: "refunds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_refund_lines_RefundId",
                schema: "sales",
                table: "refund_lines",
                column: "RefundId");

            migrationBuilder.CreateIndex(
                name: "IX_refunds_BranchId_Number",
                schema: "sales",
                table: "refunds",
                columns: new[] { "BranchId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refunds_ShiftId",
                schema: "sales",
                table: "refunds",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_refunds_TicketId",
                schema: "sales",
                table: "refunds",
                column: "TicketId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branch_pricing",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "refund_lines",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "refunds",
                schema: "sales");

            migrationBuilder.DropColumn(
                name: "ServiceCharge",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "ServiceChargeRate",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "Subtotal",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "Total",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "Vat",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "VatIncluded",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "VatRate",
                schema: "sales",
                table: "tickets");

            migrationBuilder.DropSequence(
                name: "refundlineseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "refundseq",
                schema: "sales");
        }
    }
}
