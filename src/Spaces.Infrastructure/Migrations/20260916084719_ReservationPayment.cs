using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReservationPayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PaidAt",
                schema: "spaces",
                table: "reservations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaidWith",
                schema: "spaces",
                table: "reservations",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReceiptNumber",
                schema: "spaces",
                table: "reservations",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaidAt",
                schema: "spaces",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "PaidWith",
                schema: "spaces",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "ReceiptNumber",
                schema: "spaces",
                table: "reservations");
        }
    }
}
