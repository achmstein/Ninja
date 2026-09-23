using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class KitchenStations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "kitchenprintjobseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "kitchenstationseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "orderstationpartseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                schema: "ordering",
                table: "orderItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StationId",
                schema: "ordering",
                table: "orderItems",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "kitchenprintjobs",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: true),
                    StationId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClaimedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ClaimedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PrintedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    LastError = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsReprint = table.Column<bool>(type: "boolean", nullable: false),
                    IsTest = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kitchenprintjobs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "kitchenstations",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CategoryIds = table.Column<List<int>>(type: "integer[]", nullable: false),
                    ShowsOnScreen = table.Column<bool>(type: "boolean", nullable: false),
                    PrintsTickets = table.Column<bool>(type: "boolean", nullable: false),
                    PrinterHost = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    PrinterPort = table.Column<int>(type: "integer", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kitchenstations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "orderstationparts",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StationId = table.Column<int>(type: "integer", nullable: false),
                    ShowsOnScreen = table.Column<bool>(type: "boolean", nullable: false),
                    PrintsTickets = table.Column<bool>(type: "boolean", nullable: false),
                    ReadyAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    StationName = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orderstationparts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_orderstationparts_orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "ordering",
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_kitchenprintjobs_BranchId_PrintedAt",
                schema: "ordering",
                table: "kitchenprintjobs",
                columns: new[] { "BranchId", "PrintedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_kitchenstations_BranchId",
                schema: "ordering",
                table: "kitchenstations",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_orderstationparts_OrderId",
                schema: "ordering",
                table: "orderstationparts",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_orderstationparts_StationId",
                schema: "ordering",
                table: "orderstationparts",
                column: "StationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "kitchenprintjobs",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "kitchenstations",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "orderstationparts",
                schema: "ordering");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                schema: "ordering",
                table: "orderItems");

            migrationBuilder.DropColumn(
                name: "StationId",
                schema: "ordering",
                table: "orderItems");

            migrationBuilder.DropSequence(
                name: "kitchenprintjobseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "kitchenstationseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "orderstationpartseq",
                schema: "ordering");
        }
    }
}
