using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <summary>
    /// Seated now means the party is here: at a plain table the reservation
    /// keeps the table until the staff complete it, at a timed place the
    /// stay's end completes it. Until now Seated was the end of the story,
    /// so every reservation seated so far is a party that has long left.
    /// </summary>
    public partial class SeatedIsHereNow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE spaces.reservations
                SET "Status" = 'Completed',
                    "ClosedAt" = COALESCE("ClosedAt", "SeatedAt", now())
                WHERE "Status" = 'Seated';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE spaces.reservations
                SET "Status" = 'Seated', "ClosedAt" = NULL
                WHERE "Status" = 'Completed';
                """);
        }
    }
}
