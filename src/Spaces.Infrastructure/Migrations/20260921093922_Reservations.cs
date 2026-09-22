using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <summary>
    /// The reservation becomes its own thing. Until now a hold was a stay
    /// that had not started; now a Reservation is the promise and a Stay is
    /// the clock. Every stay that never ran moves across, id and all.
    /// </summary>
    public partial class Reservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The new shape first: the table, its sequence, the columns
            migrationBuilder.CreateSequence(
                name: "reservationseq",
                schema: "spaces",
                incrementBy: 10);

            migrationBuilder.AddColumn<bool>(
                name: "Reservable",
                schema: "spaces",
                table: "places",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ReservationId",
                schema: "spaces",
                table: "stays",
                type: "integer",
                nullable: true);

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

            migrationBuilder.CreateIndex(
                name: "IX_stays_ReservationId",
                schema: "spaces",
                table: "stays",
                column: "ReservationId");

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

            // Every timed place took reservations; keep it that way
            migrationBuilder.Sql("""
                UPDATE spaces.places SET "Reservable" = ("Tariff" IS NOT NULL);
                """);

            // A stay whose clock never started was a reservation all along:
            // a hold still waiting is Requested; one given up is Cancelled,
            // or Expired when it lapsed on its own (that path stamped EndedAt).
            // It keeps its id, so nothing a phone remembers points nowhere,
            // and the sequence moves past the ids it inherited.
            migrationBuilder.Sql("""
                INSERT INTO spaces.reservations
                    ("Id", "PlaceId", "BranchId", "CustomerId", "CustomerName", "PartySize", "For", "CreatedAt", "ExpiresAt",
                     "StartOnConfirm", "RequestedOptionCode", "Status", "Notes", "StayId", "SeatedAt", "ClosedAt")
                SELECT s."Id", s."PlaceId", p."BranchId", s."CustomerId", s."CustomerName", NULL, NULL, s."CreatedAt",
                       CASE WHEN s."Status" = 'Held' THEN s."ExpiresAt" END,
                       s."StartOnConfirm", s."RequestedOptionCode",
                       CASE WHEN s."Status" = 'Held' THEN 'Requested'
                            WHEN s."EndedAt" IS NOT NULL THEN 'Expired'
                            ELSE 'Cancelled' END,
                       s."Notes", NULL, NULL,
                       CASE WHEN s."Status" = 'Held' THEN NULL ELSE COALESCE(s."EndedAt", s."CreatedAt") END
                FROM spaces.stays s
                JOIN spaces.places p ON p."Id" = s."PlaceId"
                WHERE s."StartedAt" IS NULL;

                DELETE FROM spaces.stays WHERE "StartedAt" IS NULL;

                SELECT CASE WHEN EXISTS (SELECT 1 FROM spaces.reservations)
                    THEN setval('spaces.reservationseq', (SELECT MAX("Id") FROM spaces.reservations)) END;
                """);

            // What is left in stays all ran, and the hold fields are the reservation's now
            migrationBuilder.AlterColumn<DateTime>(
                name: "StartedAt",
                schema: "spaces",
                table: "stays",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.DropIndex(
                name: "IX_stays_Status_ExpiresAt",
                schema: "spaces",
                table: "stays");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                schema: "spaces",
                table: "stays");

            migrationBuilder.DropColumn(
                name: "RequestedOptionCode",
                schema: "spaces",
                table: "stays");

            migrationBuilder.DropColumn(
                name: "StartOnConfirm",
                schema: "spaces",
                table: "stays");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiresAt",
                schema: "spaces",
                table: "stays",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestedOptionCode",
                schema: "spaces",
                table: "stays",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "StartOnConfirm",
                schema: "spaces",
                table: "stays",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<DateTime>(
                name: "StartedAt",
                schema: "spaces",
                table: "stays",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.CreateIndex(
                name: "IX_stays_Status_ExpiresAt",
                schema: "spaces",
                table: "stays",
                columns: new[] { "Status", "ExpiresAt" });

            // Open reservations go back to being held stays; closed ones are
            // history the old shape cannot hold and are left behind
            migrationBuilder.Sql("""
                INSERT INTO spaces.stays
                    ("Id", "PlaceId", "CustomerId", "CustomerName", "CreatedAt", "ExpiresAt", "StartOnConfirm", "RequestedOptionCode",
                     "Tariff", "Status", "Notes")
                SELECT r."Id", r."PlaceId", r."CustomerId", r."CustomerName", r."CreatedAt", r."ExpiresAt", r."StartOnConfirm", r."RequestedOptionCode",
                       p."Tariff", 'Held', r."Notes"
                FROM spaces.reservations r
                JOIN spaces.places p ON p."Id" = r."PlaceId"
                WHERE r."Status" IN ('Requested', 'Confirmed') AND p."Tariff" IS NOT NULL;
                """);

            migrationBuilder.DropTable(
                name: "reservations",
                schema: "spaces");

            migrationBuilder.DropIndex(
                name: "IX_stays_ReservationId",
                schema: "spaces",
                table: "stays");

            migrationBuilder.DropColumn(
                name: "ReservationId",
                schema: "spaces",
                table: "stays");

            migrationBuilder.DropColumn(
                name: "Reservable",
                schema: "spaces",
                table: "places");

            migrationBuilder.DropSequence(
                name: "reservationseq",
                schema: "spaces");
        }
    }
}
