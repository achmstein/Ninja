using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAccessCode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_reservations_AccessCode",
                schema: "rooms",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "AccessCode",
                schema: "rooms",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "AccessCodeGeneratedAt",
                schema: "rooms",
                table: "reservations");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccessCode",
                schema: "rooms",
                table: "reservations",
                type: "character varying(6)",
                maxLength: 6,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AccessCodeGeneratedAt",
                schema: "rooms",
                table: "reservations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_reservations_AccessCode",
                schema: "rooms",
                table: "reservations",
                column: "AccessCode");
        }
    }
}
