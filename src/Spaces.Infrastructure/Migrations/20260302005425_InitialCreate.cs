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
                name: "rooms");

            migrationBuilder.CreateSequence(
                name: "reservationseq",
                schema: "rooms",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "roomseq",
                schema: "rooms",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "sessionmemberseq",
                schema: "rooms",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "sessionsegmentseq",
                schema: "rooms",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "IntegrationEventLog",
                schema: "rooms",
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
                name: "requests",
                schema: "rooms",
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
                name: "rooms",
                schema: "rooms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    SingleRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MultiRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    PhysicalStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Description = table.Column<string>(type: "jsonb", nullable: true),
                    Name = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rooms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "reservations",
                schema: "rooms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    RoomId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AccessCode = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: true),
                    AccessCodeGeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActualStartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SingleRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MultiRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrentPlayerMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TotalCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_reservations_rooms_RoomId",
                        column: x => x.RoomId,
                        principalSchema: "rooms",
                        principalTable: "rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "session_members",
                schema: "rooms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    ReservationId = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_session_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_session_members_reservations_ReservationId",
                        column: x => x.ReservationId,
                        principalSchema: "rooms",
                        principalTable: "reservations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "session_segments",
                schema: "rooms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    ReservationId = table.Column<int>(type: "integer", nullable: false),
                    PlayerMode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    HourlyRate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_session_segments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_session_segments_reservations_ReservationId",
                        column: x => x.ReservationId,
                        principalSchema: "rooms",
                        principalTable: "reservations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_reservations_AccessCode",
                schema: "rooms",
                table: "reservations",
                column: "AccessCode");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_CreatedAt",
                schema: "rooms",
                table: "reservations",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_CustomerId",
                schema: "rooms",
                table: "reservations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_CustomerId_Status",
                schema: "rooms",
                table: "reservations",
                columns: new[] { "CustomerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_reservations_RoomId_Status",
                schema: "rooms",
                table: "reservations",
                columns: new[] { "RoomId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_reservations_Status",
                schema: "rooms",
                table: "reservations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_Status_ExpiresAt",
                schema: "rooms",
                table: "reservations",
                columns: new[] { "Status", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_rooms_BranchId",
                schema: "rooms",
                table: "rooms",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_rooms_PhysicalStatus",
                schema: "rooms",
                table: "rooms",
                column: "PhysicalStatus");

            migrationBuilder.CreateIndex(
                name: "IX_session_members_CustomerId",
                schema: "rooms",
                table: "session_members",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_session_members_ReservationId",
                schema: "rooms",
                table: "session_members",
                column: "ReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_session_members_ReservationId_CustomerId",
                schema: "rooms",
                table: "session_members",
                columns: new[] { "ReservationId", "CustomerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_session_segments_ReservationId",
                schema: "rooms",
                table: "session_segments",
                column: "ReservationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IntegrationEventLog",
                schema: "rooms");

            migrationBuilder.DropTable(
                name: "requests",
                schema: "rooms");

            migrationBuilder.DropTable(
                name: "session_members",
                schema: "rooms");

            migrationBuilder.DropTable(
                name: "session_segments",
                schema: "rooms");

            migrationBuilder.DropTable(
                name: "reservations",
                schema: "rooms");

            migrationBuilder.DropTable(
                name: "rooms",
                schema: "rooms");

            migrationBuilder.DropSequence(
                name: "reservationseq",
                schema: "rooms");

            migrationBuilder.DropSequence(
                name: "roomseq",
                schema: "rooms");

            migrationBuilder.DropSequence(
                name: "sessionmemberseq",
                schema: "rooms");

            migrationBuilder.DropSequence(
                name: "sessionsegmentseq",
                schema: "rooms");
        }
    }
}
