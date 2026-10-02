using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class BranchDayTurnsOver : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A branch's day turns over at its old closing time rather than at its opening: open 17:00 to
            // 05:00, its day is 05:00 to 05:00 and a whole night is one day, where the hours between closing
            // and opening were left out of every report
            migrationBuilder.Sql("""UPDATE "Branches" SET "DayStartTime" = "DayEndTime";""");

            migrationBuilder.DropColumn(
                name: "DayEndTime",
                table: "Branches");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "DayEndTime",
                table: "Branches",
                type: "time without time zone",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            // Back to a whole day: the end at the start
            migrationBuilder.Sql("""UPDATE "Branches" SET "DayEndTime" = "DayStartTime";""");
        }
    }
}
