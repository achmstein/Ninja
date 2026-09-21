using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <summary>
    /// The Spaces module is two: Reservations and TimeBilling. A tenant who
    /// bought Spaces on top of their plan bought both; the add-ons are stored
    /// by name.
    /// </summary>
    public partial class ReservationsAndTimeBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Tenants"
                SET "Addons" = array_cat(array_remove("Addons", 'Spaces'), ARRAY['Reservations', 'TimeBilling'])
                WHERE 'Spaces' = ANY("Addons");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Tenants"
                SET "Addons" = array_append(array_remove(array_remove("Addons", 'Reservations'), 'TimeBilling'), 'Spaces')
                WHERE 'Reservations' = ANY("Addons") OR 'TimeBilling' = ANY("Addons");
                """);
        }
    }
}
