using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Payroll.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PaidDaysOffAndPayChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PaidOffDays",
                schema: "payroll",
                table: "payslips",
                type: "numeric(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateOnly>(
                name: "TermsChangedOn",
                schema: "payroll",
                table: "payslips",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaidOffDays",
                schema: "payroll",
                table: "payslips");

            migrationBuilder.DropColumn(
                name: "TermsChangedOn",
                schema: "payroll",
                table: "payslips");
        }
    }
}
