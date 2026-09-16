using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spaces.Infrastructure.Migrations
{
    /// <summary>
    /// Rooms and tables become places; reservations become stays. Every row
    /// survives with its id: rooms keep theirs (their printed stickers say
    /// /room/{id}), tables get new place ids and remember the old one, and
    /// every reservation, member and segment is renamed in place. The two
    /// rate columns fold into a tariff JSON of two options, "single" and
    /// "multi", so the words every consumer reads stay the same.
    /// </summary>
    public partial class Places : Migration
    {
        private const string RoomTariffSql = """
            jsonb_build_object(
                'Options', jsonb_build_array(
                    jsonb_build_object('Code', 'single', 'HourlyRate', "SingleRate", 'Name', jsonb_build_object('En', 'Single', 'Ar', 'سنجل')),
                    jsonb_build_object('Code', 'multi',  'HourlyRate', "MultiRate",  'Name', jsonb_build_object('En', 'Multi',  'Ar', 'ملتي'))),
                'RoundingMinutes', 15)
            """;

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ---- sequences keep counting where they were
            migrationBuilder.Sql("""
                ALTER SEQUENCE spaces.roomseq RENAME TO placeseq;
                ALTER SEQUENCE spaces.reservationseq RENAME TO stayseq;
                ALTER SEQUENCE spaces.sessionmemberseq RENAME TO staymemberseq;
                ALTER SEQUENCE spaces.sessionsegmentseq RENAME TO staysegmentseq;
                """);

            // ---- rooms -> places (same ids)
            migrationBuilder.Sql($"""
                ALTER TABLE spaces.rooms RENAME TO places;
                ALTER TABLE spaces.places RENAME CONSTRAINT "PK_rooms" TO "PK_places";
                ALTER INDEX spaces."IX_rooms_BranchId" RENAME TO "IX_places_BranchId";
                ALTER INDEX spaces."IX_rooms_PhysicalStatus" RENAME TO "IX_places_PhysicalStatus";

                ALTER TABLE spaces.places ADD COLUMN "Kind" character varying(20) NOT NULL DEFAULT 'Room';
                ALTER TABLE spaces.places ADD COLUMN "IsActive" boolean NOT NULL DEFAULT TRUE;
                ALTER TABLE spaces.places ADD COLUMN "Tariff" jsonb NULL;
                ALTER TABLE spaces.places ADD COLUMN "LegacyRoomId" integer NULL;
                ALTER TABLE spaces.places ADD COLUMN "LegacyTableId" integer NULL;

                UPDATE spaces.places SET
                    "LegacyRoomId" = "Id",
                    "Tariff" = {RoomTariffSql},
                    "PhysicalStatus" = CASE WHEN "PhysicalStatus" = 'Maintenance' THEN 'OutOfService' ELSE "PhysicalStatus" END;

                ALTER TABLE spaces.places ALTER COLUMN "Kind" DROP DEFAULT;
                ALTER TABLE spaces.places DROP COLUMN "SingleRate";
                ALTER TABLE spaces.places DROP COLUMN "MultiRate";

                CREATE INDEX "IX_places_Kind" ON spaces.places ("Kind");
                CREATE UNIQUE INDEX "IX_places_LegacyRoomId" ON spaces.places ("LegacyRoomId");
                CREATE UNIQUE INDEX "IX_places_LegacyTableId" ON spaces.places ("LegacyTableId");
                """);

            // ---- tables -> places of kind Table, no tariff; each takes a fresh
            // HiLo block start so it can never collide with an id EF hands out
            migrationBuilder.Sql("""
                DO $$
                DECLARE t record;
                BEGIN
                    FOR t IN SELECT * FROM spaces.tables ORDER BY "Id" LOOP
                        INSERT INTO spaces.places ("Id", "Kind", "BranchId", "PhysicalStatus", "IsActive", "LegacyTableId", "Name")
                        VALUES (nextval('spaces.placeseq'), 'Table', t."BranchId", 'Available', t."IsActive", t."Id", t."Name");
                    END LOOP;
                END $$;

                DROP TABLE spaces.tables;
                DROP SEQUENCE spaces.tableseq;
                """);

            // ---- reservations -> stays
            migrationBuilder.Sql($"""
                ALTER TABLE spaces.reservations RENAME TO stays;
                ALTER TABLE spaces.stays RENAME CONSTRAINT "PK_reservations" TO "PK_stays";
                ALTER TABLE spaces.stays RENAME CONSTRAINT "FK_reservations_rooms_RoomId" TO "FK_stays_places_PlaceId";
                ALTER TABLE spaces.stays RENAME COLUMN "RoomId" TO "PlaceId";
                ALTER TABLE spaces.stays RENAME COLUMN "ActualStartTime" TO "StartedAt";
                ALTER TABLE spaces.stays RENAME COLUMN "EndTime" TO "EndedAt";
                ALTER TABLE spaces.stays RENAME COLUMN "CurrentPlayerMode" TO "CurrentOptionCode";
                ALTER TABLE spaces.stays ALTER COLUMN "CurrentOptionCode" TYPE character varying(40);
                ALTER INDEX spaces."IX_reservations_CreatedAt" RENAME TO "IX_stays_CreatedAt";
                ALTER INDEX spaces."IX_reservations_CustomerId" RENAME TO "IX_stays_CustomerId";
                ALTER INDEX spaces."IX_reservations_CustomerId_Status" RENAME TO "IX_stays_CustomerId_Status";
                ALTER INDEX spaces."IX_reservations_RoomId_Status" RENAME TO "IX_stays_PlaceId_Status";
                ALTER INDEX spaces."IX_reservations_Status" RENAME TO "IX_stays_Status";
                ALTER INDEX spaces."IX_reservations_Status_ExpiresAt" RENAME TO "IX_stays_Status_ExpiresAt";

                ALTER TABLE spaces.stays ADD COLUMN "StartOnConfirm" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE spaces.stays ADD COLUMN "Tariff" jsonb NULL;

                UPDATE spaces.stays SET
                    "Tariff" = {RoomTariffSql},
                    "CurrentOptionCode" = lower("CurrentOptionCode"),
                    "Status" = CASE "Status"
                        WHEN 'Reserved' THEN 'Held'
                        WHEN 'Active' THEN 'Running'
                        WHEN 'Completed' THEN 'Ended'
                        ELSE "Status" END;

                ALTER TABLE spaces.stays ALTER COLUMN "Tariff" SET NOT NULL;
                ALTER TABLE spaces.stays DROP COLUMN "SingleRate";
                ALTER TABLE spaces.stays DROP COLUMN "MultiRate";
                """);

            // ---- session_members -> stay_members
            migrationBuilder.Sql("""
                ALTER TABLE spaces.session_members RENAME TO stay_members;
                ALTER TABLE spaces.stay_members RENAME CONSTRAINT "PK_session_members" TO "PK_stay_members";
                ALTER TABLE spaces.stay_members RENAME CONSTRAINT "FK_session_members_reservations_ReservationId" TO "FK_stay_members_stays_StayId";
                ALTER TABLE spaces.stay_members RENAME COLUMN "ReservationId" TO "StayId";
                ALTER INDEX spaces."IX_session_members_CustomerId" RENAME TO "IX_stay_members_CustomerId";
                ALTER INDEX spaces."IX_session_members_ReservationId" RENAME TO "IX_stay_members_StayId";
                ALTER INDEX spaces."IX_session_members_ReservationId_CustomerId" RENAME TO "IX_stay_members_StayId_CustomerId";
                """);

            // ---- session_segments -> stay_segments
            migrationBuilder.Sql("""
                ALTER TABLE spaces.session_segments RENAME TO stay_segments;
                ALTER TABLE spaces.stay_segments RENAME CONSTRAINT "PK_session_segments" TO "PK_stay_segments";
                ALTER TABLE spaces.stay_segments RENAME CONSTRAINT "FK_session_segments_reservations_ReservationId" TO "FK_stay_segments_stays_StayId";
                ALTER TABLE spaces.stay_segments RENAME COLUMN "ReservationId" TO "StayId";
                ALTER TABLE spaces.stay_segments RENAME COLUMN "PlayerMode" TO "OptionCode";
                ALTER TABLE spaces.stay_segments ALTER COLUMN "OptionCode" TYPE character varying(40);
                ALTER INDEX spaces."IX_session_segments_ReservationId" RENAME TO "IX_stay_segments_StayId";
                UPDATE spaces.stay_segments SET "OptionCode" = lower("OptionCode");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Places that were never rooms cannot go back into rooms; tables
            // are rebuilt from the places that remember a table id.
            migrationBuilder.Sql("""
                ALTER TABLE spaces.stay_segments RENAME TO session_segments;
                ALTER TABLE spaces.session_segments RENAME CONSTRAINT "PK_stay_segments" TO "PK_session_segments";
                ALTER TABLE spaces.session_segments RENAME CONSTRAINT "FK_stay_segments_stays_StayId" TO "FK_session_segments_reservations_ReservationId";
                ALTER TABLE spaces.session_segments RENAME COLUMN "StayId" TO "ReservationId";
                ALTER TABLE spaces.session_segments RENAME COLUMN "OptionCode" TO "PlayerMode";
                UPDATE spaces.session_segments SET "PlayerMode" = initcap("PlayerMode");
                ALTER TABLE spaces.session_segments ALTER COLUMN "PlayerMode" TYPE character varying(20);
                ALTER INDEX spaces."IX_stay_segments_StayId" RENAME TO "IX_session_segments_ReservationId";

                ALTER TABLE spaces.stay_members RENAME TO session_members;
                ALTER TABLE spaces.session_members RENAME CONSTRAINT "PK_stay_members" TO "PK_session_members";
                ALTER TABLE spaces.session_members RENAME CONSTRAINT "FK_stay_members_stays_StayId" TO "FK_session_members_reservations_ReservationId";
                ALTER TABLE spaces.session_members RENAME COLUMN "StayId" TO "ReservationId";
                ALTER INDEX spaces."IX_stay_members_CustomerId" RENAME TO "IX_session_members_CustomerId";
                ALTER INDEX spaces."IX_stay_members_StayId" RENAME TO "IX_session_members_ReservationId";
                ALTER INDEX spaces."IX_stay_members_StayId_CustomerId" RENAME TO "IX_session_members_ReservationId_CustomerId";

                ALTER TABLE spaces.stays RENAME TO reservations;
                ALTER TABLE spaces.reservations RENAME CONSTRAINT "PK_stays" TO "PK_reservations";
                ALTER TABLE spaces.reservations RENAME CONSTRAINT "FK_stays_places_PlaceId" TO "FK_reservations_rooms_RoomId";
                ALTER TABLE spaces.reservations RENAME COLUMN "PlaceId" TO "RoomId";
                ALTER TABLE spaces.reservations RENAME COLUMN "StartedAt" TO "ActualStartTime";
                ALTER TABLE spaces.reservations RENAME COLUMN "EndedAt" TO "EndTime";
                ALTER TABLE spaces.reservations RENAME COLUMN "CurrentOptionCode" TO "CurrentPlayerMode";
                ALTER INDEX spaces."IX_stays_CreatedAt" RENAME TO "IX_reservations_CreatedAt";
                ALTER INDEX spaces."IX_stays_CustomerId" RENAME TO "IX_reservations_CustomerId";
                ALTER INDEX spaces."IX_stays_CustomerId_Status" RENAME TO "IX_reservations_CustomerId_Status";
                ALTER INDEX spaces."IX_stays_PlaceId_Status" RENAME TO "IX_reservations_RoomId_Status";
                ALTER INDEX spaces."IX_stays_Status" RENAME TO "IX_reservations_Status";
                ALTER INDEX spaces."IX_stays_Status_ExpiresAt" RENAME TO "IX_reservations_Status_ExpiresAt";
                ALTER TABLE spaces.reservations ADD COLUMN "SingleRate" numeric(18,2) NOT NULL DEFAULT 0;
                ALTER TABLE spaces.reservations ADD COLUMN "MultiRate" numeric(18,2) NOT NULL DEFAULT 0;
                UPDATE spaces.reservations SET
                    "SingleRate" = COALESCE((SELECT (o->>'HourlyRate')::numeric FROM jsonb_array_elements("Tariff"->'Options') o WHERE o->>'Code' = 'single' LIMIT 1), 0),
                    "MultiRate" = COALESCE((SELECT (o->>'HourlyRate')::numeric FROM jsonb_array_elements("Tariff"->'Options') o WHERE o->>'Code' = 'multi' LIMIT 1), 0),
                    "CurrentPlayerMode" = initcap("CurrentPlayerMode"),
                    "Status" = CASE "Status"
                        WHEN 'Held' THEN 'Reserved'
                        WHEN 'Running' THEN 'Active'
                        WHEN 'Ended' THEN 'Completed'
                        ELSE "Status" END;
                ALTER TABLE spaces.reservations ALTER COLUMN "SingleRate" DROP DEFAULT;
                ALTER TABLE spaces.reservations ALTER COLUMN "MultiRate" DROP DEFAULT;
                ALTER TABLE spaces.reservations ALTER COLUMN "CurrentPlayerMode" TYPE character varying(20);
                ALTER TABLE spaces.reservations DROP COLUMN "Tariff";
                ALTER TABLE spaces.reservations DROP COLUMN "StartOnConfirm";

                CREATE SEQUENCE spaces.tableseq START WITH 1 INCREMENT BY 10;
                CREATE TABLE spaces.tables (
                    "Id" integer NOT NULL,
                    "BranchId" integer NOT NULL DEFAULT 1,
                    "IsActive" boolean NOT NULL DEFAULT TRUE,
                    "Name" jsonb NOT NULL,
                    CONSTRAINT "PK_tables" PRIMARY KEY ("Id"));
                CREATE INDEX "IX_tables_BranchId" ON spaces.tables ("BranchId");
                INSERT INTO spaces.tables ("Id", "BranchId", "IsActive", "Name")
                    SELECT "LegacyTableId", "BranchId", "IsActive", "Name" FROM spaces.places WHERE "LegacyTableId" IS NOT NULL;
                SELECT setval('spaces.tableseq', COALESCE((SELECT max("Id") FROM spaces.tables), 0) + 10);
                DELETE FROM spaces.places WHERE "LegacyRoomId" IS NULL;

                ALTER TABLE spaces.places RENAME TO rooms;
                ALTER TABLE spaces.rooms RENAME CONSTRAINT "PK_places" TO "PK_rooms";
                ALTER INDEX spaces."IX_places_BranchId" RENAME TO "IX_rooms_BranchId";
                ALTER INDEX spaces."IX_places_PhysicalStatus" RENAME TO "IX_rooms_PhysicalStatus";
                DROP INDEX spaces."IX_places_Kind";
                DROP INDEX spaces."IX_places_LegacyRoomId";
                DROP INDEX spaces."IX_places_LegacyTableId";
                ALTER TABLE spaces.rooms ADD COLUMN "SingleRate" numeric(18,2) NOT NULL DEFAULT 0;
                ALTER TABLE spaces.rooms ADD COLUMN "MultiRate" numeric(18,2) NOT NULL DEFAULT 0;
                UPDATE spaces.rooms SET
                    "SingleRate" = COALESCE((SELECT (o->>'HourlyRate')::numeric FROM jsonb_array_elements("Tariff"->'Options') o WHERE o->>'Code' = 'single' LIMIT 1), 0),
                    "MultiRate" = COALESCE((SELECT (o->>'HourlyRate')::numeric FROM jsonb_array_elements("Tariff"->'Options') o WHERE o->>'Code' = 'multi' LIMIT 1), 0),
                    "PhysicalStatus" = CASE WHEN "PhysicalStatus" = 'OutOfService' THEN 'Maintenance' ELSE "PhysicalStatus" END;
                ALTER TABLE spaces.rooms ALTER COLUMN "SingleRate" DROP DEFAULT;
                ALTER TABLE spaces.rooms ALTER COLUMN "MultiRate" DROP DEFAULT;
                ALTER TABLE spaces.rooms DROP COLUMN "Kind";
                ALTER TABLE spaces.rooms DROP COLUMN "IsActive";
                ALTER TABLE spaces.rooms DROP COLUMN "Tariff";
                ALTER TABLE spaces.rooms DROP COLUMN "LegacyRoomId";
                ALTER TABLE spaces.rooms DROP COLUMN "LegacyTableId";

                ALTER SEQUENCE spaces.placeseq RENAME TO roomseq;
                ALTER SEQUENCE spaces.stayseq RENAME TO reservationseq;
                ALTER SEQUENCE spaces.staymemberseq RENAME TO sessionmemberseq;
                ALTER SEQUENCE spaces.staysegmentseq RENAME TO sessionsegmentseq;
                """);
        }
    }
}
