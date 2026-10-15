using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryFeeLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The delivery fee was an order line like the items until it was
            // marked as the fee; mark the ones already billed, so the reports
            // keep them out of what was sold. A fee line is the one a delivery
            // order added with no catalog item, at a positive price, under the
            // name the confirmation gives it.
            migrationBuilder.Sql("""
                UPDATE sales.ticket_lines
                SET "Source" = 'DeliveryFee'
                WHERE "Source" = 'Order'
                  AND "OrderId" IS NOT NULL
                  AND "CatalogItemId" IS NULL
                  AND "UnitPrice" > 0
                  AND "Description" ->> 'En' = 'Delivery fee';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE sales.ticket_lines
                SET "Source" = 'Order'
                WHERE "Source" = 'DeliveryFee';
                """);
        }
    }
}
