using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class TenantSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "tenantsettings",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    GuestOrdersAnywhere = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenantsettings", x => x.Id);
                });

            // The café's setting rode on every branch's row; the latest one
            // said it last. Tenant.API says it again when it starts, and that
            // is newer than any branch row, so this only bridges the gap.
            migrationBuilder.Sql("""
                INSERT INTO ordering.tenantsettings ("Id", "GuestOrdersAnywhere", "UpdatedAt")
                SELECT 1, "GuestOrdersAnywhere", "UpdatedAt"
                FROM ordering.branchsettings
                ORDER BY "UpdatedAt" DESC
                LIMIT 1;
                """);

            migrationBuilder.DropColumn(
                name: "GuestOrdersAnywhere",
                schema: "ordering",
                table: "branchsettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "GuestOrdersAnywhere",
                schema: "ordering",
                table: "branchsettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("""
                UPDATE ordering.branchsettings
                SET "GuestOrdersAnywhere" = COALESCE((SELECT "GuestOrdersAnywhere" FROM ordering.tenantsettings WHERE "Id" = 1), false);
                """);

            migrationBuilder.DropTable(
                name: "tenantsettings",
                schema: "ordering");
        }
    }
}
