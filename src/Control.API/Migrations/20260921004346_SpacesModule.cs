using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <summary>The Rooms module is Spaces now; the add-ons a tenant bought are stored by name.</summary>
    public partial class SpacesModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Tenants" SET "Addons" = array_replace("Addons", 'Rooms', 'Spaces') WHERE 'Rooms' = ANY("Addons");""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Tenants" SET "Addons" = array_replace("Addons", 'Spaces', 'Rooms') WHERE 'Spaces' = ANY("Addons");""");
        }
    }
}
