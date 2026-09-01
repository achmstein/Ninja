using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGuestOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GuestId",
                schema: "ordering",
                table: "orders",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestName",
                schema: "ordering",
                table: "orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuestPhone",
                schema: "ordering",
                table: "orders",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_GuestId",
                schema: "ordering",
                table: "orders",
                column: "GuestId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_orders_GuestId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "GuestId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "GuestName",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "GuestPhone",
                schema: "ordering",
                table: "orders");
        }
    }
}
