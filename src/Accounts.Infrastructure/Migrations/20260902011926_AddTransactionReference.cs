using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Accounts.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionReference : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Reference",
                schema: "accounts",
                table: "account_transactions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_account_transactions_Reference",
                schema: "accounts",
                table: "account_transactions",
                column: "Reference",
                unique: true,
                filter: "\"Reference\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_account_transactions_Reference",
                schema: "accounts",
                table: "account_transactions");

            migrationBuilder.DropColumn(
                name: "Reference",
                schema: "accounts",
                table: "account_transactions");
        }
    }
}
