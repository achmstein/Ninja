using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <summary>
    /// Tickets settled before the bill was frozen onto the ticket (the
    /// BillChargesAndRefunds migration) carry Subtotal/Total = 0, so the
    /// receipts list and the range report read them as nothing while the
    /// lines still add up. Freeze them now from their lines: no VAT and no
    /// service charge existed then, so Subtotal = Total = the line sum.
    /// </summary>
    public partial class BackfillSettledBills : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE sales.tickets t
                SET "Subtotal" = s.amount, "Total" = s.amount
                FROM (
                    SELECT "TicketId", SUM("Qty" * "UnitPrice" - "Discount") AS amount
                    FROM sales.ticket_lines
                    GROUP BY "TicketId"
                ) s
                WHERE s."TicketId" = t."Id"
                  AND t."Status" = 'Settled'
                  AND t."Total" = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only: the frozen figures are what those tickets always meant
        }
    }
}
