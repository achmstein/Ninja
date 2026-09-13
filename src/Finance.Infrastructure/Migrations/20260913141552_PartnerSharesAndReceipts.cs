using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Finance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PartnerSharesAndReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "partnershareseq",
                schema: "finance",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "expense_receipts",
                schema: "finance",
                columns: table => new
                {
                    ExpenseId = table.Column<int>(type: "integer", nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Data = table.Column<byte[]>(type: "bytea", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UploadedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_expense_receipts", x => x.ExpenseId);
                });

            migrationBuilder.CreateTable(
                name: "partner_shares",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    PartnerId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_partner_shares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_partner_shares_partners_PartnerId",
                        column: x => x.PartnerId,
                        principalSchema: "finance",
                        principalTable: "partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_partner_shares_PartnerId_BranchId",
                schema: "finance",
                table: "partner_shares",
                columns: new[] { "PartnerId", "BranchId" },
                unique: true);

            // Partners saved before shares existed keep their branches, each as a full share until edited
            migrationBuilder.Sql("""
                INSERT INTO finance.partner_shares ("Id", "PartnerId", "BranchId", "Percent")
                SELECT row_number() OVER (ORDER BY p."Id", b.branch_id), p."Id", b.branch_id, 100
                FROM finance.partners p
                CROSS JOIN LATERAL unnest(p."BranchIds") AS b(branch_id);

                -- HiLo hands out ids above the sequence's last value; start it past what was just inserted
                SELECT setval('finance.partnershareseq', GREATEST((SELECT COALESCE(MAX("Id"), 0) FROM finance.partner_shares), 1));
                """);

            migrationBuilder.DropColumn(
                name: "BranchIds",
                schema: "finance",
                table: "partners");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "expense_receipts",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "partner_shares",
                schema: "finance");

            migrationBuilder.DropSequence(
                name: "partnershareseq",
                schema: "finance");

            migrationBuilder.AddColumn<List<int>>(
                name: "BranchIds",
                schema: "finance",
                table: "partners",
                type: "integer[]",
                nullable: false);
        }
    }
}
