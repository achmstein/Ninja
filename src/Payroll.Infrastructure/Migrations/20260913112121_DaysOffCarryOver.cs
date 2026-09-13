using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DaysOffCarryOver : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "DaysOffAllowance",
                schema: "payroll",
                table: "payslips",
                type: "numeric(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DaysOffCarriedIn",
                schema: "payroll",
                table: "payslips",
                type: "numeric(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DaysOffUnused",
                schema: "payroll",
                table: "payslips",
                type: "numeric(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DaysOffAllowance",
                schema: "payroll",
                table: "payslips");

            migrationBuilder.DropColumn(
                name: "DaysOffCarriedIn",
                schema: "payroll",
                table: "payslips");

            migrationBuilder.DropColumn(
                name: "DaysOffUnused",
                schema: "payroll",
                table: "payslips");
        }
    }
}
