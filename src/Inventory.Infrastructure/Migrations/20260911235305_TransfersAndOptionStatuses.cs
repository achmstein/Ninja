using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Inventory.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TransfersAndOptionStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "transferlineseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "transferseq",
                schema: "inventory",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "menu_option_stock_statuses",
                schema: "inventory",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    OptionId = table.Column<int>(type: "integer", nullable: false),
                    InStock = table.Column<bool>(type: "boolean", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_menu_option_stock_statuses", x => new { x.BranchId, x.OptionId });
                });

            migrationBuilder.CreateTable(
                name: "transfers",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    FromBranchId = table.Column<int>(type: "integer", nullable: false),
                    ToBranchId = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SentBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_transfers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "transfer_lines",
                schema: "inventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StockItemId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    TransferId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_transfer_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_transfer_lines_stock_items_StockItemId",
                        column: x => x.StockItemId,
                        principalSchema: "inventory",
                        principalTable: "stock_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_transfer_lines_transfers_TransferId",
                        column: x => x.TransferId,
                        principalSchema: "inventory",
                        principalTable: "transfers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_transfer_lines_StockItemId",
                schema: "inventory",
                table: "transfer_lines",
                column: "StockItemId");

            migrationBuilder.CreateIndex(
                name: "IX_transfer_lines_TransferId",
                schema: "inventory",
                table: "transfer_lines",
                column: "TransferId");

            migrationBuilder.CreateIndex(
                name: "IX_transfers_FromBranchId_SentAt",
                schema: "inventory",
                table: "transfers",
                columns: new[] { "FromBranchId", "SentAt" });

            migrationBuilder.CreateIndex(
                name: "IX_transfers_ToBranchId_SentAt",
                schema: "inventory",
                table: "transfers",
                columns: new[] { "ToBranchId", "SentAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "menu_option_stock_statuses",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "transfer_lines",
                schema: "inventory");

            migrationBuilder.DropTable(
                name: "transfers",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "transferlineseq",
                schema: "inventory");

            migrationBuilder.DropSequence(
                name: "transferseq",
                schema: "inventory");
        }
    }
}
