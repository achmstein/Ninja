using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BranchDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DeliveryFee",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DeliveryMinimumOrder",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DeliveryRadiusKm",
                schema: "ordering",
                table: "branchsettings",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeliveryEnabled",
                schema: "ordering",
                table: "branchsettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                schema: "ordering",
                table: "branchsettings",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                schema: "ordering",
                table: "branchsettings",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeliveryFee",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "DeliveryMinimumOrder",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "DeliveryRadiusKm",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "IsDeliveryEnabled",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "Latitude",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "Longitude",
                schema: "ordering",
                table: "branchsettings");
        }
    }
}
