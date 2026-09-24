using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PrintConnectors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "connectorpairingseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "printconnectorseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.AddColumn<int>(
                name: "ConnectorId",
                schema: "ordering",
                table: "kitchenstations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrinterName",
                schema: "ordering",
                table: "kitchenstations",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "connectorpairings",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Language = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_connectorpairings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "printconnectors",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    KeyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Language = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    PairedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Printers = table.Column<List<string>>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_printconnectors", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_connectorpairings_Code",
                schema: "ordering",
                table: "connectorpairings",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_printconnectors_BranchId",
                schema: "ordering",
                table: "printconnectors",
                column: "BranchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "connectorpairings",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "printconnectors",
                schema: "ordering");

            migrationBuilder.DropColumn(
                name: "ConnectorId",
                schema: "ordering",
                table: "kitchenstations");

            migrationBuilder.DropColumn(
                name: "PrinterName",
                schema: "ordering",
                table: "kitchenstations");

            migrationBuilder.DropSequence(
                name: "connectorpairingseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "printconnectorseq",
                schema: "ordering");
        }
    }
}
