using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryPinSources : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Delivery_DeliveredLatitude",
                schema: "ordering",
                table: "orders",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Delivery_DeliveredLongitude",
                schema: "ordering",
                table: "orders",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_LocationShareToken",
                schema: "ordering",
                table: "orders",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_PinSource",
                schema: "ordering",
                table: "orders",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "locationshares",
                schema: "delivery",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Token = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    AccuracyMeters = table.Column<double>(type: "double precision", nullable: true),
                    SharedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_locationshares", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_Delivery_LocationShareToken",
                schema: "ordering",
                table: "orders",
                column: "Delivery_LocationShareToken");

            migrationBuilder.CreateIndex(
                name: "IX_locationshares_Token",
                schema: "delivery",
                table: "locationshares",
                column: "Token",
                unique: true);

            // Deliveries from before: a pin was the customer's own in the app (the till sent pins too, but
            // which of them came from a search can't be told now); none, None
            migrationBuilder.Sql("""
                UPDATE ordering.orders
                SET "Delivery_PinSource" = CASE WHEN "Delivery_Latitude" IS NULL THEN 'None' ELSE 'Customer' END
                WHERE "Delivery_Address" IS NOT NULL AND "Delivery_PinSource" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "locationshares",
                schema: "delivery");

            migrationBuilder.DropIndex(
                name: "IX_orders_Delivery_LocationShareToken",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_DeliveredLatitude",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_DeliveredLongitude",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_LocationShareToken",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_PinSource",
                schema: "ordering",
                table: "orders");
        }
    }
}
