using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Accounts.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Source",
                schema: "accounts",
                table: "account_transactions",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Manual");

            migrationBuilder.AddColumn<int>(
                name: "SourceNumber",
                schema: "accounts",
                table: "account_transactions",
                type: "integer",
                nullable: true);

            // Lines the till already posted carried their number as English
            // prose ("POS receipt #7"); move it into the columns and drop the
            // prose so every app renders them in the user's language
            migrationBuilder.Sql("""
                UPDATE accounts.account_transactions
                SET "Source" = 'PosReceipt',
                    "SourceNumber" = (regexp_match("Description", '^POS receipt #(\d+)$'))[1]::int,
                    "Description" = NULL
                WHERE "Reference" LIKE 'sales-ticket:%'
                  AND "Description" ~ '^POS receipt #\d+$';

                UPDATE accounts.account_transactions
                SET "Source" = 'PosCreditNote',
                    "SourceNumber" = (regexp_match("Description", '^POS credit note #(\d+)'))[1]::int,
                    "Description" = NULL
                WHERE "Reference" LIKE 'sales-refund:%'
                  AND "Description" ~ '^POS credit note #\d+';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Source",
                schema: "accounts",
                table: "account_transactions");

            migrationBuilder.DropColumn(
                name: "SourceNumber",
                schema: "accounts",
                table: "account_transactions");
        }
    }
}
