using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliverySchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "delivery");

            migrationBuilder.RenameTable(
                name: "riderstatuses",
                schema: "ordering",
                newName: "riderstatuses",
                newSchema: "delivery");

            migrationBuilder.RenameTable(
                name: "rideraccounts",
                schema: "ordering",
                newName: "rideraccounts",
                newSchema: "delivery");

            migrationBuilder.RenameTable(
                name: "customeraddresses",
                schema: "ordering",
                newName: "customeraddresses",
                newSchema: "delivery");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "riderstatuses",
                schema: "delivery",
                newName: "riderstatuses",
                newSchema: "ordering");

            migrationBuilder.RenameTable(
                name: "rideraccounts",
                schema: "delivery",
                newName: "rideraccounts",
                newSchema: "ordering");

            migrationBuilder.RenameTable(
                name: "customeraddresses",
                schema: "delivery",
                newName: "customeraddresses",
                newSchema: "ordering");
        }
    }
}
