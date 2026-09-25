using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <summary>
    /// The Spaces switch is two: Reservations and TimeBilling. A café that
    /// had Spaces on (or was entitled to it) has both on (entitled) now; the
    /// next entitlements push from the control plane settles each on its own.
    /// </summary>
    public partial class ReservationsAndTimeBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SpacesEntitled",
                table: "Tenants",
                newName: "TimeBillingEntitled");

            migrationBuilder.RenameColumn(
                name: "SpacesEnabled",
                table: "Tenants",
                newName: "TimeBillingEnabled");

            migrationBuilder.AddColumn<bool>(
                name: "ReservationsEnabled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ReservationsEntitled",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("""
                UPDATE "Tenants" SET "ReservationsEnabled" = "TimeBillingEnabled", "ReservationsEntitled" = "TimeBillingEntitled";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Spaces is on when either half was
            migrationBuilder.Sql("""
                UPDATE "Tenants" SET "TimeBillingEnabled" = "TimeBillingEnabled" OR "ReservationsEnabled",
                                     "TimeBillingEntitled" = "TimeBillingEntitled" OR "ReservationsEntitled";
                """);

            migrationBuilder.DropColumn(
                name: "ReservationsEnabled",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "ReservationsEntitled",
                table: "Tenants");

            migrationBuilder.RenameColumn(
                name: "TimeBillingEntitled",
                table: "Tenants",
                newName: "SpacesEntitled");

            migrationBuilder.RenameColumn(
                name: "TimeBillingEnabled",
                table: "Tenants",
                newName: "SpacesEnabled");
        }
    }
}
