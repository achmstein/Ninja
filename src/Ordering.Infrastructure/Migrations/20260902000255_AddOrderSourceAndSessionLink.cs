using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderSourceAndSessionLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RoomId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SessionId",
                schema: "ordering",
                table: "orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Customer");

            // Orders placed before Source existed: a guest id marks a guest
            // order; everything else was a signed-in customer (the default)
            migrationBuilder.Sql(
                """UPDATE ordering.orders SET "Source" = 'Guest' WHERE "GuestId" IS NOT NULL;""");

            migrationBuilder.CreateIndex(
                name: "IX_orders_SessionId",
                schema: "ordering",
                table: "orders",
                column: "SessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_orders_SessionId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "RoomId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "SessionId",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Source",
                schema: "ordering",
                table: "orders");
        }
    }
}
