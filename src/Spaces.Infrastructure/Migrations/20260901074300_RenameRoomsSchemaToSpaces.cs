using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameRoomsSchemaToSpaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "spaces");

            migrationBuilder.RenameTable(
                name: "session_segments",
                schema: "rooms",
                newName: "session_segments",
                newSchema: "spaces");

            migrationBuilder.RenameTable(
                name: "session_members",
                schema: "rooms",
                newName: "session_members",
                newSchema: "spaces");

            migrationBuilder.RenameTable(
                name: "rooms",
                schema: "rooms",
                newName: "rooms",
                newSchema: "spaces");

            migrationBuilder.RenameTable(
                name: "reservations",
                schema: "rooms",
                newName: "reservations",
                newSchema: "spaces");

            migrationBuilder.RenameTable(
                name: "requests",
                schema: "rooms",
                newName: "requests",
                newSchema: "spaces");

            migrationBuilder.RenameTable(
                name: "IntegrationEventLog",
                schema: "rooms",
                newName: "IntegrationEventLog",
                newSchema: "spaces");

            migrationBuilder.RenameSequence(
                name: "sessionsegmentseq",
                schema: "rooms",
                newName: "sessionsegmentseq",
                newSchema: "spaces");

            migrationBuilder.RenameSequence(
                name: "sessionmemberseq",
                schema: "rooms",
                newName: "sessionmemberseq",
                newSchema: "spaces");

            migrationBuilder.RenameSequence(
                name: "roomseq",
                schema: "rooms",
                newName: "roomseq",
                newSchema: "spaces");

            migrationBuilder.RenameSequence(
                name: "reservationseq",
                schema: "rooms",
                newName: "reservationseq",
                newSchema: "spaces");

            // Moving every object leaves an empty "rooms" schema behind. Drop it only when it is
            // genuinely empty, so anything unexpected in there is preserved rather than destroyed.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'rooms'
                    ) THEN
                        EXECUTE 'DROP SCHEMA IF EXISTS rooms';
                    END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "rooms");

            migrationBuilder.RenameTable(
                name: "session_segments",
                schema: "spaces",
                newName: "session_segments",
                newSchema: "rooms");

            migrationBuilder.RenameTable(
                name: "session_members",
                schema: "spaces",
                newName: "session_members",
                newSchema: "rooms");

            migrationBuilder.RenameTable(
                name: "rooms",
                schema: "spaces",
                newName: "rooms",
                newSchema: "rooms");

            migrationBuilder.RenameTable(
                name: "reservations",
                schema: "spaces",
                newName: "reservations",
                newSchema: "rooms");

            migrationBuilder.RenameTable(
                name: "requests",
                schema: "spaces",
                newName: "requests",
                newSchema: "rooms");

            migrationBuilder.RenameTable(
                name: "IntegrationEventLog",
                schema: "spaces",
                newName: "IntegrationEventLog",
                newSchema: "rooms");

            migrationBuilder.RenameSequence(
                name: "sessionsegmentseq",
                schema: "spaces",
                newName: "sessionsegmentseq",
                newSchema: "rooms");

            migrationBuilder.RenameSequence(
                name: "sessionmemberseq",
                schema: "spaces",
                newName: "sessionmemberseq",
                newSchema: "rooms");

            migrationBuilder.RenameSequence(
                name: "roomseq",
                schema: "spaces",
                newName: "roomseq",
                newSchema: "rooms");

            migrationBuilder.RenameSequence(
                name: "reservationseq",
                schema: "spaces",
                newName: "reservationseq",
                newSchema: "rooms");
        }
    }
}
