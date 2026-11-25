using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CourierDeliveries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Delivery_CourierCollected",
                schema: "ordering",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "Delivery_CourierCollectedAt",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Delivery_CourierFee",
                schema: "ordering",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_CourierJobId",
                schema: "ordering",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_CourierName",
                schema: "ordering",
                table: "orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_CourierPhone",
                schema: "ordering",
                table: "orders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_CourierProvider",
                schema: "ordering",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Delivery_CourierProviderId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Delivery_CourierTrackingUrl",
                schema: "ordering",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CourierName",
                schema: "delivery",
                table: "deliveryassignments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CourierProvider",
                schema: "delivery",
                table: "deliveryassignments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CourierProviderId",
                schema: "delivery",
                table: "deliveryassignments",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "couriercompanies",
                schema: "delivery",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    DefaultFee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_couriercompanies", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "couriercompanies",
                schema: "delivery");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierCollected",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierCollectedAt",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierFee",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierJobId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierName",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierPhone",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierProvider",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierProviderId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Delivery_CourierTrackingUrl",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CourierName",
                schema: "delivery",
                table: "deliveryassignments");

            migrationBuilder.DropColumn(
                name: "CourierProvider",
                schema: "delivery",
                table: "deliveryassignments");

            migrationBuilder.DropColumn(
                name: "CourierProviderId",
                schema: "delivery",
                table: "deliveryassignments");
        }
    }
}
