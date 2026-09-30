using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Ninja.Tenant.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Branches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TaxNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    DayStartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    DayEndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    IsOrderingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsReservationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    RequireSignInForTableOrders = table.Column<bool>(type: "boolean", nullable: false),
                    Address = table.Column<string>(type: "jsonb", nullable: true),
                    Name = table.Column<string>(type: "jsonb", nullable: false),
                    ReceiptFooter = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Branches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    PrimaryColor = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    CustomerUrl = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Images = table.Column<string>(type: "jsonb", nullable: false),
                    Country = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    TimeZone = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    DefaultLanguage = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    ArabicStyle = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    BusinessType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    GuestOrdersAnywhere = table.Column<bool>(type: "boolean", nullable: false),
                    ReservationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    TimeBillingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LoyaltyEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    TabsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    InventoryEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    FinanceEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    PayrollEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    KdsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    OnlinePaymentsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    ReservationsEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    TimeBillingEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    LoyaltyEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    TabsEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    InventoryEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    FinanceEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    PayrollEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    KdsEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    OnlinePaymentsEntitled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Assistant = table.Column<string>(type: "jsonb", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false),
                    Theme = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Branches_DisplayOrder",
                table: "Branches",
                column: "DisplayOrder");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_IsActive",
                table: "Branches",
                column: "IsActive");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Branches");

            migrationBuilder.DropTable(
                name: "Tenants");
        }
    }
}
