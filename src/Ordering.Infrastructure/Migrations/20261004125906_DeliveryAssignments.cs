using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "deliveryassignments",
                schema: "delivery",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    RiderUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    RiderName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PreviousRiderUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActorUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ActorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ActorRole = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CashCollected = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_deliveryassignments", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_deliveryassignments_OrderId_At",
                schema: "delivery",
                table: "deliveryassignments",
                columns: new[] { "OrderId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_deliveryassignments_PreviousRiderUserId_At",
                schema: "delivery",
                table: "deliveryassignments",
                columns: new[] { "PreviousRiderUserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_deliveryassignments_RiderUserId_At",
                schema: "delivery",
                table: "deliveryassignments",
                columns: new[] { "RiderUserId", "At" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "deliveryassignments",
                schema: "delivery");
        }
    }
}
