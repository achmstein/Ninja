using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConnectedCouriers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Delivery_CourierSequence",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApiBaseUrl",
                schema: "delivery",
                table: "couriercompanies",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SealedApiKey",
                schema: "delivery",
                table: "couriercompanies",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SealedWebhookSecret",
                schema: "delivery",
                table: "couriercompanies",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AddressAr",
                schema: "ordering",
                table: "branchsettings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AddressEn",
                schema: "ordering",
                table: "branchsettings",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameAr",
                schema: "ordering",
                table: "branchsettings",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameEn",
                schema: "ordering",
                table: "branchsettings",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: "ordering",
                table: "branchsettings",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Delivery_CourierSequence",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "ApiBaseUrl",
                schema: "delivery",
                table: "couriercompanies");

            migrationBuilder.DropColumn(
                name: "SealedApiKey",
                schema: "delivery",
                table: "couriercompanies");

            migrationBuilder.DropColumn(
                name: "SealedWebhookSecret",
                schema: "delivery",
                table: "couriercompanies");

            migrationBuilder.DropColumn(
                name: "AddressAr",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "AddressEn",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "NameAr",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "NameEn",
                schema: "ordering",
                table: "branchsettings");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: "ordering",
                table: "branchsettings");
        }
    }
}
