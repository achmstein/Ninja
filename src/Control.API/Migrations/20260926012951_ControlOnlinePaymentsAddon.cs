using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ninja.Control.API.Migrations
{
    /// <inheritdoc />
    public partial class ControlOnlinePaymentsAddon : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The PayAtTable module is OnlinePayments now; a bought add-on is stored by its name
            migrationBuilder.Sql("""UPDATE "Tenants" SET "Addons" = array_replace("Addons", 'PayAtTable', 'OnlinePayments') WHERE 'PayAtTable' = ANY("Addons");""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "Tenants" SET "Addons" = array_replace("Addons", 'OnlinePayments', 'PayAtTable') WHERE 'OnlinePayments' = ANY("Addons");""");
        }
    }
}
