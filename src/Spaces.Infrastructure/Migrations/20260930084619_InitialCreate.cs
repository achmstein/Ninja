using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "spaces");

            migrationBuilder.CreateSequence(
                name: "placeseq",
                schema: "spaces",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "reservationseq",
                schema: "spaces",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "staymemberseq",
                schema: "spaces",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "staysegmentseq",
                schema: "spaces",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "stayseq",
                schema: "spaces",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "branchsettings",
                schema: "spaces",
                columns: table => new
                {
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    IsOrderingEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    IsReservationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_branchsettings", x => x.BranchId);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationEventLog",
                schema: "spaces",
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
                name: "places",
                schema: "spaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    PhysicalStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    Reservable = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Description = table.Column<string>(type: "jsonb", nullable: true),
                    Name = table.Column<string>(type: "jsonb", nullable: false),
                    Tariff = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_places", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "requests",
                schema: "spaces",
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
                name: "tenantfeatures",
                schema: "spaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Reservations = table.Column<bool>(type: "boolean", nullable: false),
                    TimeBilling = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenantfeatures", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "reservations",
                schema: "spaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    PlaceId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PartySize = table.Column<int>(type: "integer", nullable: true),
                    For = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StartOnConfirm = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    RequestedOptionCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    StayId = table.Column<int>(type: "integer", nullable: true),
                    SeatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_reservations_places_PlaceId",
                        column: x => x.PlaceId,
                        principalSchema: "spaces",
                        principalTable: "places",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stays",
                schema: "spaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    PlaceId = table.Column<int>(type: "integer", nullable: false),
                    ReservationId = table.Column<int>(type: "integer", nullable: true),
                    CustomerId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CurrentOptionCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    TotalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ReceiptNumber = table.Column<int>(type: "integer", nullable: true),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TicketId = table.Column<int>(type: "integer", nullable: true),
                    PaidWith = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Tariff = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stays_places_PlaceId",
                        column: x => x.PlaceId,
                        principalSchema: "spaces",
                        principalTable: "places",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "stay_members",
                schema: "spaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StayId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stay_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stay_members_stays_StayId",
                        column: x => x.StayId,
                        principalSchema: "spaces",
                        principalTable: "stays",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stay_segments",
                schema: "spaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    StayId = table.Column<int>(type: "integer", nullable: false),
                    OptionCode = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    HourlyRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stay_segments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stay_segments_stays_StayId",
                        column: x => x.StayId,
                        principalSchema: "spaces",
                        principalTable: "stays",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_places_BranchId",
                schema: "spaces",
                table: "places",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_places_Kind",
                schema: "spaces",
                table: "places",
                column: "Kind");

            migrationBuilder.CreateIndex(
                name: "IX_places_PhysicalStatus",
                schema: "spaces",
                table: "places",
                column: "PhysicalStatus");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_BranchId_Status",
                schema: "spaces",
                table: "reservations",
                columns: new[] { "BranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_reservations_CustomerId",
                schema: "spaces",
                table: "reservations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_CustomerId_Status",
                schema: "spaces",
                table: "reservations",
                columns: new[] { "CustomerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_reservations_PlaceId_Status",
                schema: "spaces",
                table: "reservations",
                columns: new[] { "PlaceId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_reservations_Status_ExpiresAt",
                schema: "spaces",
                table: "reservations",
                columns: new[] { "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_stay_members_CustomerId",
                schema: "spaces",
                table: "stay_members",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_stay_members_StayId",
                schema: "spaces",
                table: "stay_members",
                column: "StayId");

            migrationBuilder.CreateIndex(
                name: "IX_stay_members_StayId_CustomerId",
                schema: "spaces",
                table: "stay_members",
                columns: new[] { "StayId", "CustomerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stay_segments_StayId",
                schema: "spaces",
                table: "stay_segments",
                column: "StayId");

            migrationBuilder.CreateIndex(
                name: "IX_stays_CreatedAt",
                schema: "spaces",
                table: "stays",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_stays_CustomerId",
                schema: "spaces",
                table: "stays",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_stays_CustomerId_Status",
                schema: "spaces",
                table: "stays",
                columns: new[] { "CustomerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_stays_PlaceId_Status",
                schema: "spaces",
                table: "stays",
                columns: new[] { "PlaceId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_stays_ReservationId",
                schema: "spaces",
                table: "stays",
                column: "ReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_stays_Status",
                schema: "spaces",
                table: "stays",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "branchsettings",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "IntegrationEventLog",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "requests",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "reservations",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "stay_members",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "stay_segments",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "tenantfeatures",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "stays",
                schema: "spaces");

            migrationBuilder.DropTable(
                name: "places",
                schema: "spaces");

            migrationBuilder.DropSequence(
                name: "placeseq",
                schema: "spaces");

            migrationBuilder.DropSequence(
                name: "reservationseq",
                schema: "spaces");

            migrationBuilder.DropSequence(
                name: "staymemberseq",
                schema: "spaces");

            migrationBuilder.DropSequence(
                name: "staysegmentseq",
                schema: "spaces");

            migrationBuilder.DropSequence(
                name: "stayseq",
                schema: "spaces");
        }
    }
}
