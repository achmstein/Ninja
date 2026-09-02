using System;
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
                name: "paymentseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "receiptseq",
                schema: "sales",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "shiftseq",
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
                    OpeningFloat = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ClosingCount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ExpectedCash = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    OverShort = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shifts", x => x.Id);
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
                    RoomId = table.Column<int>(type: "integer", nullable: true),
                    TableId = table.Column<int>(type: "integer", nullable: true),
                    CustomerId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    GuestPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    OpenedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SettledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SettledBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ShiftId = table.Column<int>(type: "integer", nullable: true),
                    VoidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VoidedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    VoidReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ChangeGiven = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    LastActivityAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LocationName = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tickets", x => x.Id);
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
                    Qty = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Discount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AddedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
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
                name: "IX_tickets_SessionId",
                schema: "sales",
                table: "tickets",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_tickets_TableId_Status",
                schema: "sales",
                table: "tickets",
                columns: new[] { "TableId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cash_movements",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "IntegrationEventLog",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "payments",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "receipts",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "requests",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "ticket_lines",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "shifts",
                schema: "sales");

            migrationBuilder.DropTable(
                name: "tickets",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "cashmovementseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "paymentseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "receiptseq",
                schema: "sales");

            migrationBuilder.DropSequence(
                name: "shiftseq",
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
