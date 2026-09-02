using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPerPaymentAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CustomerId",
                schema: "sales",
                table: "ticket_lines",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerId",
                schema: "sales",
                table: "payments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerName",
                schema: "sales",
                table: "payments",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CustomerId",
                schema: "sales",
                table: "ticket_lines");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                schema: "sales",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "CustomerName",
                schema: "sales",
                table: "payments");
        }
    }
}
