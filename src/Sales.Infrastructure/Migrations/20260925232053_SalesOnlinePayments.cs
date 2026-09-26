using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SalesOnlinePayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "onlinepaymentseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "online_payments",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Key = table.Column<Guid>(type: "uuid", nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Fee = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Tip = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    Mode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    LineIds = table.Column<List<int>>(type: "integer[]", nullable: false),
                    Parts = table.Column<int>(type: "integer", nullable: true),
                    Of = table.Column<int>(type: "integer", nullable: true),
                    PayerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PayerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ProviderReference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TransactionId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FailureReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RefundedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RefundedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_online_payments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "payment_settings",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    SealedSecretKey = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    SecretKeyHint = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true),
                    PublicKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SealedHmacSecret = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CardIntegrationId = table.Column<int>(type: "integer", nullable: true),
                    WalletIntegrationId = table.Column<int>(type: "integer", nullable: true),
                    ApplePayIntegrationId = table.Column<int>(type: "integer", nullable: true),
                    FeeMode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FeePercent = table.Column<decimal>(type: "numeric(6,3)", precision: 6, scale: 3, nullable: false),
                    FeeFixed = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    TipsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    TipPercents = table.Column<List<int>>(type: "integer[]", nullable: false),
                    AllowItems = table.Column<bool>(type: "boolean", nullable: false),
                    AllowEqual = table.Column<bool>(type: "boolean", nullable: false),
                    AllowCustom = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_settings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_BranchId_PaidAt",
                schema: "sales",
                table: "online_payments",
                columns: new[] { "BranchId", "PaidAt" });

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_Key",
                schema: "sales",
                table: "online_payments",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_Provider_ProviderReference",
                schema: "sales",
                table: "online_payments",
                columns: new[] { "Provider", "ProviderReference" });

            migrationBuilder.CreateIndex(
                name: "IX_online_payments_TicketId",
                schema: "sales",
                table: "online_payments",
                column: "TicketId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "online_payments",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "payment_settings",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "onlinepaymentseq",
                schema: "sales");
        }
    }
}
