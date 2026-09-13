using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StaffPayOuts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OpenedByUserId",
                schema: "sales",
                table: "shifts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmployeeId",
                schema: "sales",
                table: "cash_movements",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployeeName",
                schema: "sales",
                table: "cash_movements",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                schema: "sales",
                table: "cash_movements",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Other");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OpenedByUserId",
                schema: "sales",
                table: "shifts");

            migrationBuilder.DropColumn(
                name: "EmployeeId",
                schema: "sales",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "EmployeeName",
                schema: "sales",
                table: "cash_movements");

            migrationBuilder.DropColumn(
                name: "Kind",
                schema: "sales",
                table: "cash_movements");
        }
    }
}
