using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Branch.API.Migrations
{
    /// <inheritdoc />
    public partial class TenantBrand : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    PrimaryColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    CustomerUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    LogoVersion = table.Column<long>(type: "bigint", nullable: false),
                    RoomsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LoyaltyEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    TabsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    InventoryEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    FinanceEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    PayrollEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    KdsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Tenants");
        }
    }
}
