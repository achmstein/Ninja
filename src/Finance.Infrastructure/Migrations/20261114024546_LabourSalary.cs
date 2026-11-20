using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Finance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LabourSalary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Salary",
                schema: "finance",
                table: "labour_facts",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateOnly>(
                name: "SalaryFrom",
                schema: "finance",
                table: "labour_facts",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "SalaryTo",
                schema: "finance",
                table: "labour_facts",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Salary",
                schema: "finance",
                table: "labour_facts");

            migrationBuilder.DropColumn(
                name: "SalaryFrom",
                schema: "finance",
                table: "labour_facts");

            migrationBuilder.DropColumn(
                name: "SalaryTo",
                schema: "finance",
                table: "labour_facts");
        }
    }
}
