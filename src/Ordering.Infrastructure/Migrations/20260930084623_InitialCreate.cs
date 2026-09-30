using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ordering.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "ordering");

            migrationBuilder.CreateSequence(
                name: "buyerseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "connectorpairingseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "guestblockseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "kitchenprintjobseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "kitchenstationseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "orderitemseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "orderratingseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "orderseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "orderstationpartseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "platformupdateseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "printconnectorseq",
                schema: "ordering",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "branchsettings",
                schema: "ordering",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    IsOrderingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsReservationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    RequireSignInForTableOrders = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branchsettings", x => x.BranchId);
                });

            migrationBuilder.CreateTable(
                name: "buyers",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    IdentityGuid = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_buyers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "connectorpairings",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Language = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_connectorpairings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "guestblocks",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    GuestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    BlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BlockedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: true),
                    BlockedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_guestblocks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationEventLog",
                schema: "ordering",
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
                name: "kitchenprintjobs",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: true),
                    StationId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ClaimedBy = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ClaimedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PrintedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    LastError = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsReprint = table.Column<bool>(type: "boolean", nullable: false),
                    IsTest = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kitchenprintjobs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "kitchenstations",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CategoryIds = table.Column<List<int>>(type: "integer[]", nullable: false),
                    ShowsOnScreen = table.Column<bool>(type: "boolean", nullable: false),
                    PrintsTickets = table.Column<bool>(type: "boolean", nullable: false),
                    PrinterHost = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    PrinterPort = table.Column<int>(type: "integer", nullable: false),
                    ConnectorId = table.Column<int>(type: "integer", nullable: true),
                    PrinterName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_kitchenstations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "places",
                schema: "ordering",
                columns: table => new
                {
                    PlaceId = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    IsTimed = table.Column<bool>(type: "boolean", nullable: false),
                    HasOptions = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_places", x => x.PlaceId);
                });

            migrationBuilder.CreateTable(
                name: "platformupdates",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    Platform = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Token = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Reason = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    AcceptanceTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AbandonedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_platformupdates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "printconnectors",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    KeyHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Language = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    PairedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Printers = table.Column<List<string>>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_printconnectors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "requests",
                schema: "ordering",
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
                name: "tenantsettings",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    GuestOrdersAnywhere = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenantsettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    OrderDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BuyerId = table.Column<int>(type: "integer", nullable: true),
                    OrderStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PlaceId = table.Column<int>(type: "integer", nullable: true),
                    PlaceKind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SessionId = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "Customer"),
                    TicketId = table.Column<int>(type: "integer", nullable: true),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReceiptNumber = table.Column<int>(type: "integer", nullable: true),
                    PaidWith = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    RefundedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    VoidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CustomerNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    PointsToRedeem = table.Column<int>(type: "integer", nullable: false),
                    LoyaltyDiscount = table.Column<double>(type: "double precision", nullable: false),
                    PromoCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    PromoDiscount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    GuestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    GuestName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    GuestPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Platform_Name = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Platform_Token = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Platform_Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Platform_ShortCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Platform_Expedition = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Platform_RiderPickupAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Platform_DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Platform_DeliveryAddress = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Platform_PaidOnline = table.Column<bool>(type: "boolean", nullable: true),
                    Platform_CollectFromCustomer = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Platform_AcceptedUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Platform_RejectedUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Platform_PreparedUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Platform_PickedUpUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Platform_RejectReason = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Platform_CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Platform_PickedUpAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReminderCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastReminderSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConfirmedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReadyAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PlaceName = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_orders_buyers_BuyerId",
                        column: x => x.BuyerId,
                        principalSchema: "ordering",
                        principalTable: "buyers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "orderItems",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    PictureUrl = table.Column<string>(type: "text", nullable: true),
                    UnitPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    Discount = table.Column<decimal>(type: "numeric", nullable: false),
                    Units = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    SpecialInstructions = table.Column<string>(type: "text", nullable: true),
                    OptionIds = table.Column<List<int>>(type: "integer[]", nullable: true),
                    CategoryId = table.Column<int>(type: "integer", nullable: true),
                    StationId = table.Column<int>(type: "integer", nullable: true),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    CustomizationsDescription = table.Column<string>(type: "jsonb", nullable: true),
                    ProductName = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_orderItems_orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "ordering",
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orderratings",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    RatingValue = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orderratings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_orderratings_orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "ordering",
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orderstationparts",
                schema: "ordering",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StationId = table.Column<int>(type: "integer", nullable: false),
                    ShowsOnScreen = table.Column<bool>(type: "boolean", nullable: false),
                    PrintsTickets = table.Column<bool>(type: "boolean", nullable: false),
                    ReadyAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    OrderId = table.Column<int>(type: "integer", nullable: false),
                    StationName = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orderstationparts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_orderstationparts_orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "ordering",
                        principalTable: "orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_buyers_IdentityGuid",
                schema: "ordering",
                table: "buyers",
                column: "IdentityGuid",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_connectorpairings_Code",
                schema: "ordering",
                table: "connectorpairings",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_guestblocks_GuestId_BranchId_BlockedUntil",
                schema: "ordering",
                table: "guestblocks",
                columns: new[] { "GuestId", "BranchId", "BlockedUntil" });

            migrationBuilder.CreateIndex(
                name: "IX_kitchenprintjobs_BranchId_PrintedAt",
                schema: "ordering",
                table: "kitchenprintjobs",
                columns: new[] { "BranchId", "PrintedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_kitchenstations_BranchId",
                schema: "ordering",
                table: "kitchenstations",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_orderItems_OrderId",
                schema: "ordering",
                table: "orderItems",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_orderratings_CreatedAt",
                schema: "ordering",
                table: "orderratings",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_orderratings_OrderId",
                schema: "ordering",
                table: "orderratings",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_BranchId",
                schema: "ordering",
                table: "orders",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_BuyerId",
                schema: "ordering",
                table: "orders",
                column: "BuyerId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_GuestId",
                schema: "ordering",
                table: "orders",
                column: "GuestId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_OrderDate",
                schema: "ordering",
                table: "orders",
                column: "OrderDate");

            migrationBuilder.CreateIndex(
                name: "IX_orders_OrderStatus",
                schema: "ordering",
                table: "orders",
                column: "OrderStatus");

            migrationBuilder.CreateIndex(
                name: "IX_orders_PlaceId",
                schema: "ordering",
                table: "orders",
                column: "PlaceId");

            migrationBuilder.CreateIndex(
                name: "IX_orders_Platform_Token",
                schema: "ordering",
                table: "orders",
                column: "Platform_Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_SessionId",
                schema: "ordering",
                table: "orders",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_orderstationparts_OrderId",
                schema: "ordering",
                table: "orderstationparts",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_orderstationparts_StationId",
                schema: "ordering",
                table: "orderstationparts",
                column: "StationId");

            migrationBuilder.CreateIndex(
                name: "IX_platformupdates_OrderId",
                schema: "ordering",
                table: "platformupdates",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_platformupdates_SentAt_AbandonedAt_NextAttemptAt",
                schema: "ordering",
                table: "platformupdates",
                columns: new[] { "SentAt", "AbandonedAt", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_printconnectors_BranchId",
                schema: "ordering",
                table: "printconnectors",
                column: "BranchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branchsettings",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "connectorpairings",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "guestblocks",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "IntegrationEventLog",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "kitchenprintjobs",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "kitchenstations",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "orderItems",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "orderratings",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "orderstationparts",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "places",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "platformupdates",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "printconnectors",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "requests",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "tenantsettings",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "orders",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "buyers",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "buyerseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "connectorpairingseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "guestblockseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "kitchenprintjobseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "kitchenstationseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "orderitemseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "orderratingseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "orderseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "orderstationpartseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "platformupdateseq",
                schema: "ordering");

            migrationBuilder.DropSequence(
                name: "printconnectorseq",
                schema: "ordering");
        }
    }
}
