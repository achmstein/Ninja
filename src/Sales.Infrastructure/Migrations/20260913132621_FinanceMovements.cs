using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FinanceMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                schema: "sales",
                table: "cash_movements",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PartnerId",
                schema: "sales",
                table: "cash_movements",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PartnerName",
                schema: "sales",
                table: "cash_movements",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SupplierId",
                schema: "sales",
                table: "cash_movements",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SupplierName",
                schema: "sales",
                table: "cash_movements",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CategoryId",
                schema: "sales",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "PartnerId",
                schema: "sales",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "PartnerName",
                schema: "sales",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                schema: "sales",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "SupplierName",
                schema: "sales",
                table: "cash_movements");
        }
    }
}
