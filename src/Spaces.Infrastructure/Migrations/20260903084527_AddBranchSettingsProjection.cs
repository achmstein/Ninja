using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchSettingsProjection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "branchsettings",
                schema: "spaces",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    IsOrderingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsReservationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branchsettings", x => x.BranchId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branchsettings",
                schema: "spaces");
        }
    }
}
