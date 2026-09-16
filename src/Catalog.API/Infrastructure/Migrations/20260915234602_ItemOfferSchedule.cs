using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Catalog.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ItemOfferSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "OfferFrom",
                table: "Catalog",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "OfferTo",
                table: "Catalog",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OfferWeekdays",
                table: "Catalog",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OfferFrom",
                table: "Catalog");

            migrationBuilder.DropColumn(
                name: "OfferTo",
                table: "Catalog");

            migrationBuilder.DropColumn(
                name: "OfferWeekdays",
                table: "Catalog");
        }
    }
}
