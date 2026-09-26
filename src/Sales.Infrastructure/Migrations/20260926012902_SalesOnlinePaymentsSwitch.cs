using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SalesOnlinePaymentsSwitch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PayAtTable",
                schema: "sales",
                table: "tenantfeatures",
                newName: "OnlinePayments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "OnlinePayments",
                schema: "sales",
                table: "tenantfeatures",
                newName: "PayAtTable");
        }
    }
}
