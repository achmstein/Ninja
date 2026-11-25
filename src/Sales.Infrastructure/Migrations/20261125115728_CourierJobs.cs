using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CourierJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "courierjobs",
                schema: "sales",
                columns: table => new
                {
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    ProviderId = table.Column<int>(type: "integer", nullable: false),
                    Provider = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Collected = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Fee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: true),
                    BillTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_courierjobs", x => x.OrderId);
                });

            migrationBuilder.CreateTable(
                name: "courierpayouts",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProviderId = table.Column<int>(type: "integer", nullable: false),
                    Provider = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    RecordedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_courierpayouts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_courierjobs_ProviderId_At",
                schema: "sales",
                table: "courierjobs",
                columns: new[] { "ProviderId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_courierpayouts_ProviderId_PaidOn",
                schema: "sales",
                table: "courierpayouts",
                columns: new[] { "ProviderId", "PaidOn" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "courierjobs",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "courierpayouts",
                schema: "sales");
        }
    }
}
