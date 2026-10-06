using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OnlinePaymentHolds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CardHoldIntegrationId",
                schema: "sales",
                table: "payment_settings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AuthorizedAt",
                schema: "sales",
                table: "online_payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "CardHold",
                schema: "sales",
                table: "online_payments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "VoidedAt",
                schema: "sales",
                table: "online_payments",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CardHoldIntegrationId",
                schema: "sales",
                table: "payment_settings");

            migrationBuilder.DropColumn(
                name: "AuthorizedAt",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "CardHold",
                schema: "sales",
                table: "online_payments");

            migrationBuilder.DropColumn(
                name: "VoidedAt",
                schema: "sales",
                table: "online_payments");
        }
    }
}
