using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FeeModeBusiness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // "The business carries the provider's fee" is stored under its new name
            migrationBuilder.Sql("""UPDATE sales.payment_settings SET "FeeMode" = 'Business' WHERE "FeeMode" = 'Cafe';""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE sales.payment_settings SET "FeeMode" = 'Cafe' WHERE "FeeMode" = 'Business';""");
        }
    }
}
