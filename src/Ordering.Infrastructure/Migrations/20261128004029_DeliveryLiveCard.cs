using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryLiveCard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Phone",
                schema: "delivery",
                table: "rideraccounts",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Delivery_CustomerComingAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Delivery_NearbyAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_RiderPhone",
                schema: "ordering",
                table: "orders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "riderspots",
                schema: "delivery",
                columns: table => new
                {
                    RiderUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Told = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_riderspots", x => x.RiderUserId);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "riderspots",
                schema: "delivery");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: "delivery",
                table: "rideraccounts");

            migrationBuilder.DropColumn(
                name: "Delivery_CustomerComingAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_NearbyAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_RiderPhone",
                schema: "ordering",
                table: "orders");
        }
    }
}
