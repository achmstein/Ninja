using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Sales.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "sales");

            migrationBuilder.CreateSequence(
                name: "cashmovementseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "onlinepaymentseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "paymentseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "receiptseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "refundlineseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "refundseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "shiftseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "tabpaymentseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "ticketlineseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "ticketseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "branch_pricing",
                schema: "sales",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    VatRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    PricesIncludeVat = table.Column<bool>(type: "boolean", nullable: false),
                    ServiceChargeRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    MaxCashierDiscountRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false, defaultValue: 0.10m),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branch_pricing", x => x.BranchId);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationEventLog",
                schema: "sales",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventTypeName = table.Column<string>(type: "text", nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false),
                    TimesSent = table.Column<int>(type: "integer", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    TransactionId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IntegrationEventLog", x => x.EventId);
                });

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
                    AllowItems = table.Column<bool>(type: "boolean", nullable: false),
                    AllowEqual = table.Column<bool>(type: "boolean", nullable: false),
                    AllowCustom = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "receipts",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: false),
                    IssuedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_receipts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refunds",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: false),
                    ReceiptNumber = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Tender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RefundedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RefundedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ShiftId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refunds", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "requests",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Time = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_requests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "shifts",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OpenedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    OpenedByUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    OpeningFloat = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ClosingCount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ExpectedCash = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    OverShort = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shifts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tab_payments",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Tender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ShiftId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tab_payments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tenantfeatures",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    OnlinePayments = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenantfeatures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "tickets",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    SessionId = table.Column<int>(type: "integer", nullable: true),
                    MemberIds = table.Column<List<string>>(type: "text[]", nullable: false),
                    SessionEndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PlaceId = table.Column<int>(type: "integer", nullable: true),
                    PlaceKind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    GuestPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SettledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SettledBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ProvisionalReceiptNumber = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    ShiftId = table.Column<int>(type: "integer", nullable: true),
                    VoidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VoidedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    VoidReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ChangeGiven = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Subtotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: true),
                    DiscountReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    DiscountBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    DiscountAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ServiceCharge = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Vat = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    VatRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    ServiceChargeRate = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    VatIncluded = table.Column<bool>(type: "boolean", nullable: false),
                    LastActivityAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    LocationName = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tickets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refund_lines",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    TicketLineId = table.Column<int>(type: "integer", nullable: false),
                    Qty = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MenuAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: true),
                    RefundId = table.Column<int>(type: "integer", nullable: true),
                    Description = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refund_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_refund_lines_refunds_RefundId",
                        column: x => x.RefundId,
                        principalSchema: "sales",
                        principalTable: "refunds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "cash_movements",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Other"),
                    EmployeeId = table.Column<int>(type: "integer", nullable: true),
                    EmployeeName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    SupplierId = table.Column<int>(type: "integer", nullable: true),
                    SupplierName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PartnerId = table.Column<int>(type: "integer", nullable: true),
                    PartnerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CategoryId = table.Column<int>(type: "integer", nullable: true),
                    ShiftId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cash_movements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_cash_movements_shifts_ShiftId",
                        column: x => x.ShiftId,
                        principalSchema: "sales",
                        principalTable: "shifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Tender = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RecordedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TicketId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_payments_tickets_TicketId",
                        column: x => x.TicketId,
                        principalSchema: "sales",
                        principalTable: "tickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ticket_lines",
                schema: "sales",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: true),
                    CatalogItemId = table.Column<int>(type: "integer", nullable: true),
                    Qty = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AddedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    CustomerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    GuestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    TicketId = table.Column<int>(type: "integer", nullable: true),
                    Description = table.Column<string>(type: "jsonb", nullable: false),
                    Details = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ticket_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ticket_lines_tickets_TicketId",
                        column: x => x.TicketId,
                        principalSchema: "sales",
                        principalTable: "tickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cash_movements_ShiftId",
                schema: "sales",
                table: "cash_movements",
                column: "ShiftId");

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

            migrationBuilder.CreateIndex(
                name: "IX_payments_TicketId",
                schema: "sales",
                table: "payments",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_receipts_BranchId_Number",
                schema: "sales",
                table: "receipts",
                columns: new[] { "BranchId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_receipts_TicketId",
                schema: "sales",
                table: "receipts",
                column: "TicketId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refund_lines_RefundId",
                schema: "sales",
                table: "refund_lines",
                column: "RefundId");

            migrationBuilder.CreateIndex(
                name: "IX_refunds_BranchId_Number",
                schema: "sales",
                table: "refunds",
                columns: new[] { "BranchId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refunds_ShiftId",
                schema: "sales",
                table: "refunds",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_refunds_TicketId",
                schema: "sales",
                table: "refunds",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_shifts_BranchId",
                schema: "sales",
                table: "shifts",
                column: "BranchId",
                unique: true,
                filter: "\"Status\" = 'Open'");

            migrationBuilder.CreateIndex(
                name: "IX_shifts_BranchId_OpenedAt",
                schema: "sales",
                table: "shifts",
                columns: new[] { "BranchId", "OpenedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_BranchId_Number",
                schema: "sales",
                table: "tab_payments",
                columns: new[] { "BranchId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_BranchId_RecordedAt",
                schema: "sales",
                table: "tab_payments",
                columns: new[] { "BranchId", "RecordedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_CustomerId",
                schema: "sales",
                table: "tab_payments",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_tab_payments_ShiftId",
                schema: "sales",
                table: "tab_payments",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "IX_ticket_lines_OrderId",
                schema: "sales",
                table: "ticket_lines",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ticket_lines_TicketId",
                schema: "sales",
                table: "ticket_lines",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_tickets_BranchId_Status",
                schema: "sales",
                table: "tickets",
                columns: new[] { "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_tickets_PlaceId_Status",
                schema: "sales",
                table: "tickets",
                columns: new[] { "PlaceId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_tickets_SessionId",
                schema: "sales",
                table: "tickets",
                column: "SessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branch_pricing",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "cash_movements",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "IntegrationEventLog",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "online_payments",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "payment_settings",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "payments",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "receipts",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "refund_lines",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "requests",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "tab_payments",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "tenantfeatures",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "ticket_lines",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "shifts",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "refunds",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "tickets",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "cashmovementseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "onlinepaymentseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "paymentseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "receiptseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "refundlineseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "refundseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "shiftseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "tabpaymentseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "ticketlineseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "ticketseq",
                schema: "sales");
        }
    }
}
