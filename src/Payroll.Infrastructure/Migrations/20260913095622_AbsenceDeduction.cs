using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AbsenceDeduction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AbsenceDeduction",
                schema: "payroll",
                table: "payslips",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "AbsentDays",
                schema: "payroll",
                table: "payslips",
                type: "numeric(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "PaidDaysOff",
                schema: "payroll",
                table: "employees",
                type: "integer",
                nullable: false,
                // Everyone already on the register gets the usual one day a week
                defaultValue: 4);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AbsenceDeduction",
                schema: "payroll",
                table: "payslips");

            migrationBuilder.DropColumn(
                name: "AbsentDays",
                schema: "payroll",
                table: "payslips");

            migrationBuilder.DropColumn(
                name: "PaidDaysOff",
                schema: "payroll",
                table: "employees");
        }
    }
}
