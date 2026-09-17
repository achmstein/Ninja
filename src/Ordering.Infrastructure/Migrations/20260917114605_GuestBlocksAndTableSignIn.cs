using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class GuestBlocksAndTableSignIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "guestblockseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.AddColumn<bool>(
                name: "RequireSignInForTableOrders",
                schema: "ordering",
                table: "branchsettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "guestblocks",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    GuestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    BlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BlockedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: true),
                    BlockedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guestblocks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_guestblocks_GuestId_BranchId_BlockedUntil",
                schema: "ordering",
                table: "guestblocks",
                columns: new[] { "GuestId", "BranchId", "BlockedUntil" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "guestblocks",
                schema: "ordering");

            migrationBuilder.DropColumn(
                name: "RequireSignInForTableOrders",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropSequence(
                name: "guestblockseq",
                schema: "ordering");
        }
    }
}
